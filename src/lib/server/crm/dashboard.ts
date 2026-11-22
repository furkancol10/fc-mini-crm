import { and, desc, eq, gte, isNotNull, lt, notInArray, sql } from 'drizzle-orm';
import { requireAdmin, requireUser } from '$lib/server/auth/guard';
import type { AuthUser } from '$lib/server/auth/types';
import type { Database } from '$lib/server/db/client';
import { quotes, users, workItems, workLogs } from '$lib/server/db/schema';

export interface FinancialKpis {
	openQuoteTotalKurus: number;
	openQuoteCount: number;
	monthlyApprovedTotalKurus: number;
	monthlyApprovedCount: number;
}

export interface DashboardLogRow {
	id: number;
	workItemId: number;
	workCode: string;
	workTitle: string;
	actorName: string | null;
	type: 'status' | 'note' | 'quote' | 'payment';
	message: string;
	isPublic: boolean;
	createdAt: Date;
}

export interface DashboardSummary {
	activeWorkCount: number;
	overdueWorkCount: number;
	financial: FinancialKpis | null;
	recentLogs: DashboardLogRow[];
}

export async function getFinancialKpis(
	db: Database,
	user: AuthUser | null,
	now: Date = new Date()
): Promise<FinancialKpis> {
	requireAdmin(user);

	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

	const [openRow] = await db
		.select({
			total: sql<number>`coalesce(sum(${quotes.totalKurus}), 0)::int`,
			count: sql<number>`count(*)::int`
		})
		.from(quotes)
		.innerJoin(workItems, eq(quotes.workItemId, workItems.id))
		.where(
			and(eq(quotes.status, 'sent'), notInArray(workItems.status, ['delivered', 'cancelled']))
		);

	const [approvedRow] = await db
		.select({
			total: sql<number>`coalesce(sum(${quotes.totalKurus}), 0)::int`,
			count: sql<number>`count(*)::int`
		})
		.from(quotes)
		.where(and(eq(quotes.status, 'approved'), gte(quotes.approvedAt, monthStart)));

	return {
		openQuoteTotalKurus: openRow?.total ?? 0,
		openQuoteCount: openRow?.count ?? 0,
		monthlyApprovedTotalKurus: approvedRow?.total ?? 0,
		monthlyApprovedCount: approvedRow?.count ?? 0
	};
}

export async function getDashboardSummary(
	db: Database,
	user: AuthUser | null,
	now: Date = new Date()
): Promise<DashboardSummary> {
	const authed = requireUser(user);
	const isAdmin = authed.role === 'admin';

	const activeConditions = [notInArray(workItems.status, ['delivered', 'cancelled'])];
	if (!isAdmin) {
		activeConditions.push(eq(workItems.assignedTo, authed.id));
	}

	const [activeRow] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(workItems)
		.where(and(...activeConditions));

	const overdueConditions = [
		notInArray(workItems.status, ['delivered', 'cancelled']),
		isNotNull(workItems.dueDate),
		lt(workItems.dueDate, now)
	];
	if (!isAdmin) {
		overdueConditions.push(eq(workItems.assignedTo, authed.id));
	}

	const [overdueRow] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(workItems)
		.where(and(...overdueConditions));

	const logsBase = db
		.select({
			id: workLogs.id,
			workItemId: workLogs.workItemId,
			workCode: workItems.code,
			workTitle: workItems.title,
			actorName: users.name,
			type: workLogs.type,
			message: workLogs.message,
			isPublic: workLogs.isPublic,
			createdAt: workLogs.createdAt
		})
		.from(workLogs)
		.innerJoin(workItems, eq(workLogs.workItemId, workItems.id))
		.leftJoin(users, eq(workLogs.actorId, users.id));

	const recentLogs = isAdmin
		? await logsBase.orderBy(desc(workLogs.createdAt), desc(workLogs.id)).limit(10)
		: await logsBase
				.where(eq(workItems.assignedTo, authed.id))
				.orderBy(desc(workLogs.createdAt), desc(workLogs.id))
				.limit(10);

	const financial = isAdmin ? await getFinancialKpis(db, authed, now) : null;

	return {
		activeWorkCount: activeRow?.count ?? 0,
		overdueWorkCount: overdueRow?.count ?? 0,
		financial,
		recentLogs
	};
}
