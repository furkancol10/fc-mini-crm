import {
	and,
	asc,
	desc,
	eq,
	ilike,
	inArray,
	isNotNull,
	isNull,
	lt,
	notInArray,
	or,
	type SQL
} from 'drizzle-orm';
import { z } from 'zod';
import { calculateBalance } from '$lib/domain/balance';
import { generatePublicToken, generateWorkCode } from '$lib/domain/code';
import { parseWorkMetadata, type WorkType } from '$lib/domain/metadata';
import { assertTransition, getStatusLabel, type WorkStatus } from '$lib/domain/status';
import { requireAdmin, requireUser, requireWorkItemAccess } from '$lib/server/auth/guard';
import type { AuthUser } from '$lib/server/auth/types';
import type { Database } from '$lib/server/db/client';
import {
	customers,
	payments,
	quoteItems,
	quotes,
	users,
	workItems,
	workLogs,
	type WorkItemRow,
	type WorkLogRow
} from '$lib/server/db/schema';
import { NotFoundError } from './errors';

export const createWorkItemSchema = z.object({
	customerId: z.number().int().positive(),
	assignedTo: z.number().int().positive().nullable().optional(),
	workType: z.enum(['service', 'agency']),
	title: z.string().trim().min(2, 'İş başlığı en az 2 karakter olmalıdır').max(180),
	priority: z.enum(['low', 'normal', 'high']).default('normal'),
	description: z
		.string()
		.trim()
		.max(3000)
		.optional()
		.nullable()
		.transform((v) => (v && v.length > 0 ? v : null)),
	dueDate: z.date().nullable().optional(),
	metadata: z.unknown().optional()
});

export const updateWorkItemSchema = z.object({
	assignedTo: z.number().int().positive().nullable().optional(),
	title: z.string().trim().min(2).max(180).optional(),
	priority: z.enum(['low', 'normal', 'high']).optional(),
	description: z
		.string()
		.trim()
		.max(3000)
		.optional()
		.nullable()
		.transform((v) => (v && v.length > 0 ? v : null)),
	dueDate: z.date().nullable().optional(),
	metadata: z.unknown().optional()
});

export type CreateWorkItemInput = z.input<typeof createWorkItemSchema>;
export type UpdateWorkItemInput = z.input<typeof updateWorkItemSchema>;

export interface WorkItemListRow extends WorkItemRow {
	customerName: string;
	assigneeName: string | null;
}

export interface WorkItemFilters {
	q?: string | null;
	status?: WorkStatus | null;
	workType?: WorkType | null;
	priority?: 'low' | 'normal' | 'high' | null;
	assignedTo?: number | 'unassigned' | null;
	overdue?: boolean;
}

export async function listWorkItems(
	db: Database,
	user: AuthUser | null,
	filters?: WorkItemFilters,
	now: Date = new Date()
): Promise<WorkItemListRow[]> {
	const authed = requireUser(user);

	const conditions: SQL[] = [];

	if (authed.role === 'staff') {
		conditions.push(eq(workItems.assignedTo, authed.id));
	}

	if (filters?.assignedTo === 'unassigned') {
		conditions.push(isNull(workItems.assignedTo));
	} else if (typeof filters?.assignedTo === 'number' && Number.isInteger(filters.assignedTo)) {
		conditions.push(eq(workItems.assignedTo, filters.assignedTo));
	}

	if (filters?.status) {
		conditions.push(eq(workItems.status, filters.status));
	}
	if (filters?.workType) {
		conditions.push(eq(workItems.workType, filters.workType));
	}
	if (filters?.priority) {
		conditions.push(eq(workItems.priority, filters.priority));
	}
	if (filters?.overdue) {
		conditions.push(
			isNotNull(workItems.dueDate),
			lt(workItems.dueDate, now),
			notInArray(workItems.status, ['delivered', 'cancelled'])
		);
	}
	if (filters?.q && filters.q.trim().length > 0) {
		const pattern = `%${filters.q.trim()}%`;
		const searchCondition = or(
			ilike(workItems.code, pattern),
			ilike(workItems.title, pattern),
			ilike(customers.name, pattern),
			ilike(customers.company, pattern)
		);
		if (searchCondition) {
			conditions.push(searchCondition);
		}
	}

	const baseQuery = db
		.select({
			id: workItems.id,
			customerId: workItems.customerId,
			assignedTo: workItems.assignedTo,
			code: workItems.code,
			publicToken: workItems.publicToken,
			workType: workItems.workType,
			title: workItems.title,
			status: workItems.status,
			priority: workItems.priority,
			metadata: workItems.metadata,
			description: workItems.description,
			dueDate: workItems.dueDate,
			deliveredAt: workItems.deliveredAt,
			createdAt: workItems.createdAt,
			updatedAt: workItems.updatedAt,
			customerName: customers.name,
			assigneeName: users.name
		})
		.from(workItems)
		.innerJoin(customers, eq(workItems.customerId, customers.id))
		.leftJoin(users, eq(workItems.assignedTo, users.id));

	if (conditions.length > 0) {
		return baseQuery
			.where(and(...conditions))
			.orderBy(desc(workItems.createdAt), desc(workItems.id));
	}

	return baseQuery.orderBy(desc(workItems.createdAt), desc(workItems.id));
}

export async function getWorkItemById(
	db: Database,
	user: AuthUser | null,
	workItemId: number
): Promise<WorkItemRow> {
	const authed = requireUser(user);
	const [item] = await db.select().from(workItems).where(eq(workItems.id, workItemId)).limit(1);
	if (!item) {
		throw new NotFoundError('İş kaydı bulunamadı');
	}
	requireWorkItemAccess(authed, item);
	return item;
}

export async function getWorkItemDetail(db: Database, user: AuthUser | null, workItemId: number) {
	const authed = requireUser(user);
	const item = await getWorkItemById(db, authed, workItemId);

	const [customer] = await db
		.select()
		.from(customers)
		.where(eq(customers.id, item.customerId))
		.limit(1);

	const assignee = item.assignedTo
		? ((await db.select().from(users).where(eq(users.id, item.assignedTo)).limit(1))[0] ?? null)
		: null;

	const logs = await db
		.select({
			id: workLogs.id,
			workItemId: workLogs.workItemId,
			actorId: workLogs.actorId,
			actorName: users.name,
			type: workLogs.type,
			message: workLogs.message,
			isPublic: workLogs.isPublic,
			createdAt: workLogs.createdAt
		})
		.from(workLogs)
		.leftJoin(users, eq(workLogs.actorId, users.id))
		.where(eq(workLogs.workItemId, item.id))
		.orderBy(desc(workLogs.createdAt), desc(workLogs.id));

	if (authed.role !== 'admin') {
		return {
			item,
			customer,
			assignee,
			logs,
			quotes: [],
			payments: [],
			balance: null
		};
	}

	const quoteRows = await db
		.select()
		.from(quotes)
		.where(eq(quotes.workItemId, item.id))
		.orderBy(desc(quotes.version));

	const quoteIds = quoteRows.map((q) => q.id);
	const allQuoteItems =
		quoteIds.length > 0
			? await db
					.select()
					.from(quoteItems)
					.where(inArray(quoteItems.quoteId, quoteIds))
					.orderBy(asc(quoteItems.sortOrder), asc(quoteItems.id))
			: [];

	const itemsByQuote = new Map<number, typeof allQuoteItems>();
	for (const qi of allQuoteItems) {
		const arr = itemsByQuote.get(qi.quoteId) ?? [];
		arr.push(qi);
		itemsByQuote.set(qi.quoteId, arr);
	}

	const quotesWithItems = quoteRows.map((q) => ({
		...q,
		items: itemsByQuote.get(q.id) ?? []
	}));

	const paymentRows = await db
		.select()
		.from(payments)
		.where(eq(payments.workItemId, item.id))
		.orderBy(desc(payments.paidAt), desc(payments.id));

	const approvedQuote = quoteRows.find((q) => q.status === 'approved') ?? null;
	const balance = calculateBalance({
		approvedTotalKurus: approvedQuote ? approvedQuote.totalKurus : null,
		paymentsKurus: paymentRows.map((p) => p.amountKurus)
	});

	return {
		item,
		customer,
		assignee,
		logs,
		quotes: quotesWithItems,
		payments: paymentRows,
		balance
	};
}

export async function createWorkItem(
	db: Database,
	user: AuthUser | null,
	input: CreateWorkItemInput
): Promise<WorkItemRow> {
	const authed = requireUser(user);
	const data = createWorkItemSchema.parse(input);
	const metadata = parseWorkMetadata(data.workType, data.metadata);

	const assignedTo = authed.role === 'staff' ? authed.id : (data.assignedTo ?? null);

	return db.transaction(async (tx) => {
		const [customer] = await tx
			.select({ id: customers.id })
			.from(customers)
			.where(eq(customers.id, data.customerId))
			.limit(1);

		if (!customer) {
			throw new NotFoundError('Müşteri bulunamadı');
		}

		const [created] = await tx
			.insert(workItems)
			.values({
				customerId: data.customerId,
				assignedTo,
				code: generateWorkCode(data.workType),
				publicToken: generatePublicToken(),
				workType: data.workType,
				title: data.title,
				status: 'new',
				priority: data.priority,
				metadata,
				description: data.description ?? null,
				dueDate: data.dueDate ?? null
			})
			.returning();

		await tx.insert(workLogs).values({
			workItemId: created.id,
			actorId: authed.id,
			type: 'status',
			message: `İş kaydı oluşturuldu (${getStatusLabel('new', data.workType as WorkType)})`,
			isPublic: true
		});

		return created;
	});
}

export async function updateWorkItem(
	db: Database,
	user: AuthUser | null,
	workItemId: number,
	input: UpdateWorkItemInput
): Promise<WorkItemRow> {
	const authed = requireUser(user);
	const existing = await getWorkItemById(db, authed, workItemId);
	const data = updateWorkItemSchema.parse(input);

	const patch: Partial<typeof workItems.$inferInsert> = {
		updatedAt: new Date()
	};

	if (data.title !== undefined) patch.title = data.title;
	if (data.priority !== undefined) patch.priority = data.priority;
	if (data.description !== undefined) patch.description = data.description;
	if (data.dueDate !== undefined) patch.dueDate = data.dueDate;
	if (data.metadata !== undefined) {
		patch.metadata = parseWorkMetadata(existing.workType, data.metadata);
	}
	if (authed.role === 'admin' && data.assignedTo !== undefined) {
		patch.assignedTo = data.assignedTo;
	}

	const [updated] = await db
		.update(workItems)
		.set(patch)
		.where(eq(workItems.id, workItemId))
		.returning();

	return updated;
}

export async function transitionWorkItemStatus(
	db: Database,
	user: AuthUser | null,
	workItemId: number,
	nextStatus: WorkStatus,
	note?: string,
	isPublic = true
): Promise<WorkItemRow> {
	const authed = requireUser(user);

	return db.transaction(async (tx) => {
		// Satır kilidi: eşzamanlı geçişler sıraya girer, doğrulama kilitli güncel durumdan yapılır.
		const [item] = await tx
			.select()
			.from(workItems)
			.where(eq(workItems.id, workItemId))
			.limit(1)
			.for('update');

		if (!item) {
			throw new NotFoundError('İş kaydı bulunamadı');
		}

		requireWorkItemAccess(authed, item);
		assertTransition(item.status, nextStatus);

		const now = new Date();
		const [updated] = await tx
			.update(workItems)
			.set({
				status: nextStatus,
				deliveredAt: nextStatus === 'delivered' ? now : item.deliveredAt,
				updatedAt: now
			})
			.where(eq(workItems.id, workItemId))
			.returning();

		const fromLabel = getStatusLabel(item.status, item.workType);
		const toLabel = getStatusLabel(nextStatus, item.workType);
		const trimmedNote = note?.trim();
		const message = trimmedNote
			? `Durum değişti: ${fromLabel} → ${toLabel} (${trimmedNote})`
			: `Durum değişti: ${fromLabel} → ${toLabel}`;

		await tx.insert(workLogs).values({
			workItemId: item.id,
			actorId: authed.id,
			type: 'status',
			message,
			isPublic
		});

		return updated;
	});
}

export async function addWorkLog(
	db: Database,
	user: AuthUser | null,
	workItemId: number,
	input: { message: string; isPublic?: boolean }
): Promise<WorkLogRow> {
	const authed = requireUser(user);
	const item = await getWorkItemById(db, authed, workItemId);
	const parsed = z
		.object({
			message: z.string().trim().min(1, 'Not boş olamaz').max(2000),
			isPublic: z.boolean().default(false)
		})
		.parse(input);

	const [log] = await db
		.insert(workLogs)
		.values({
			workItemId: item.id,
			actorId: authed.id,
			type: 'note',
			message: parsed.message,
			isPublic: parsed.isPublic
		})
		.returning();

	return log;
}

export async function deleteWorkItem(
	db: Database,
	user: AuthUser | null,
	workItemId: number
): Promise<void> {
	requireAdmin(user);
	const deleted = await db
		.delete(workItems)
		.where(eq(workItems.id, workItemId))
		.returning({ id: workItems.id });

	if (deleted.length === 0) {
		throw new NotFoundError('İş kaydı bulunamadı');
	}
}
