import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { formatKurus } from '$lib/domain/money';
import type { WorkType } from '$lib/domain/metadata';
import type { WorkStatus } from '$lib/domain/status';
import type { Database } from '$lib/server/db/client';
import { quoteItems, quotes, workItems, workLogs, type QuoteRow } from '$lib/server/db/schema';
import { ConflictError, NotFoundError, ValidationError, isPgUniqueViolation } from './errors';
import { QuoteApprovalConflictError } from './quotes';

export interface PublicQuoteItem {
	id: number;
	kind: 'part' | 'labor' | 'service';
	description: string;
	qty: string;
	unitPriceKurus: number;
	vatRate: number;
	lineSubtotalKurus: number;
	lineVatKurus: number;
	lineTotalKurus: number;
}

export interface PublicQuote {
	id: number;
	quoteNo: string;
	version: number;
	status: 'sent' | 'approved' | 'rejected' | 'expired';
	vatIncluded: boolean;
	subtotalKurus: number;
	vatTotalKurus: number;
	totalKurus: number;
	notes: string | null;
	validUntil: Date | null;
	approvedAt: Date | null;
	createdAt: Date;
	items: PublicQuoteItem[];
}

export interface PublicWorkLog {
	id: number;
	type: 'status' | 'note' | 'quote' | 'payment';
	message: string;
	createdAt: Date;
}

export interface PublicWorkItemView {
	workItem: {
		code: string;
		workType: WorkType;
		title: string;
		status: WorkStatus;
		dueDate: Date | null;
		deliveredAt: Date | null;
		createdAt: Date;
		updatedAt: Date;
	};
	hasApprovedQuote: boolean;
	canDecideQuotes: boolean;
	quotes: PublicQuote[];
	publicLogs: PublicWorkLog[];
}

export async function getPublicWorkItemByToken(
	db: Database,
	token: string
): Promise<PublicWorkItemView> {
	const cleaned = token.trim();
	if (cleaned.length < 8 || cleaned.length > 128) {
		throw new NotFoundError('Takip kaydı bulunamadı');
	}

	const [item] = await db
		.select({
			id: workItems.id,
			code: workItems.code,
			workType: workItems.workType,
			title: workItems.title,
			status: workItems.status,
			dueDate: workItems.dueDate,
			deliveredAt: workItems.deliveredAt,
			createdAt: workItems.createdAt,
			updatedAt: workItems.updatedAt
		})
		.from(workItems)
		.where(eq(workItems.publicToken, cleaned))
		.limit(1);

	if (!item) {
		throw new NotFoundError('Takip kaydı bulunamadı');
	}

	const publicLogs = await db
		.select({
			id: workLogs.id,
			type: workLogs.type,
			message: workLogs.message,
			createdAt: workLogs.createdAt
		})
		.from(workLogs)
		.where(and(eq(workLogs.workItemId, item.id), eq(workLogs.isPublic, true)))
		.orderBy(desc(workLogs.createdAt), desc(workLogs.id));

	const visibleQuotes = await db
		.select({
			id: quotes.id,
			quoteNo: quotes.quoteNo,
			version: quotes.version,
			status: quotes.status,
			vatIncluded: quotes.vatIncluded,
			subtotalKurus: quotes.subtotalKurus,
			vatTotalKurus: quotes.vatTotalKurus,
			totalKurus: quotes.totalKurus,
			notes: quotes.notes,
			validUntil: quotes.validUntil,
			approvedAt: quotes.approvedAt,
			createdAt: quotes.createdAt
		})
		.from(quotes)
		.where(
			and(
				eq(quotes.workItemId, item.id),
				inArray(quotes.status, ['sent', 'approved', 'rejected', 'expired'])
			)
		)
		.orderBy(desc(quotes.version));

	const quoteIds = visibleQuotes.map((q) => q.id);
	const itemsRows =
		quoteIds.length > 0
			? await db
					.select({
						id: quoteItems.id,
						quoteId: quoteItems.quoteId,
						kind: quoteItems.kind,
						description: quoteItems.description,
						qty: quoteItems.qty,
						unitPriceKurus: quoteItems.unitPriceKurus,
						vatRate: quoteItems.vatRate,
						lineSubtotalKurus: quoteItems.lineSubtotalKurus,
						lineVatKurus: quoteItems.lineVatKurus,
						lineTotalKurus: quoteItems.lineTotalKurus
					})
					.from(quoteItems)
					.where(inArray(quoteItems.quoteId, quoteIds))
					.orderBy(asc(quoteItems.sortOrder), asc(quoteItems.id))
			: [];

	const itemsByQuote = new Map<number, PublicQuoteItem[]>();
	for (const row of itemsRows) {
		const list = itemsByQuote.get(row.quoteId) ?? [];
		list.push({
			id: row.id,
			kind: row.kind,
			description: row.description,
			qty: row.qty,
			unitPriceKurus: row.unitPriceKurus,
			vatRate: row.vatRate,
			lineSubtotalKurus: row.lineSubtotalKurus,
			lineVatKurus: row.lineVatKurus,
			lineTotalKurus: row.lineTotalKurus
		});
		itemsByQuote.set(row.quoteId, list);
	}

	const mappedQuotes: PublicQuote[] = visibleQuotes.map((q) => ({
		...q,
		status: q.status as PublicQuote['status'],
		items: itemsByQuote.get(q.id) ?? []
	}));

	const hasApprovedQuote = mappedQuotes.some((q) => q.status === 'approved');
	const canDecideQuotes =
		!hasApprovedQuote && item.status !== 'delivered' && item.status !== 'cancelled';

	return {
		workItem: {
			code: item.code,
			workType: item.workType,
			title: item.title,
			status: item.status,
			dueDate: item.dueDate,
			deliveredAt: item.deliveredAt,
			createdAt: item.createdAt,
			updatedAt: item.updatedAt
		},
		hasApprovedQuote,
		canDecideQuotes,
		quotes: mappedQuotes,
		publicLogs
	};
}

export async function approveQuoteByToken(
	db: Database,
	token: string,
	quoteId: number
): Promise<QuoteRow> {
	const cleaned = token.trim();
	if (cleaned.length < 8) {
		throw new NotFoundError('Takip kaydı bulunamadı');
	}

	try {
		return await db.transaction(async (tx) => {
			const [workItem] = await tx
				.select()
				.from(workItems)
				.where(eq(workItems.publicToken, cleaned))
				.limit(1)
				.for('update');

			if (!workItem) {
				throw new NotFoundError('Takip kaydı bulunamadı');
			}
			if (workItem.status === 'delivered' || workItem.status === 'cancelled') {
				throw new ValidationError('Teslim edilmiş veya iptal edilmiş işin teklifi onaylanamaz');
			}

			const [quote] = await tx
				.select()
				.from(quotes)
				.where(and(eq(quotes.id, quoteId), eq(quotes.workItemId, workItem.id)))
				.limit(1);

			if (!quote) {
				throw new NotFoundError('Teklif bulunamadı');
			}
			if (quote.status === 'approved') {
				throw new QuoteApprovalConflictError();
			}
			if (quote.status !== 'sent') {
				throw new ValidationError('Yalnız gönderilmiş teklifler müşteri tarafından onaylanabilir');
			}

			const now = new Date();
			const [approved] = await tx
				.update(quotes)
				.set({
					status: 'approved',
					approvedAt: now,
					updatedAt: now
				})
				.where(and(eq(quotes.id, quoteId), eq(quotes.status, 'sent')))
				.returning();

			if (!approved) {
				throw new QuoteApprovalConflictError('Teklif durumu eşzamanlı olarak değişti');
			}

			if (workItem.status === 'new' || workItem.status === 'quoted') {
				await tx
					.update(workItems)
					.set({ status: 'approved', updatedAt: now })
					.where(eq(workItems.id, workItem.id));
			}

			await tx.insert(workLogs).values({
				workItemId: workItem.id,
				actorId: null,
				type: 'quote',
				message: `Müşteri teklifi onayladı: ${approved.quoteNo} (${formatKurus(approved.totalKurus)})`,
				isPublic: true
			});

			return approved;
		});
	} catch (err) {
		if (isPgUniqueViolation(err, 'quotes_one_approved_per_work_item_idx')) {
			throw new QuoteApprovalConflictError();
		}
		throw err;
	}
}

export async function rejectQuoteByToken(
	db: Database,
	token: string,
	quoteId: number
): Promise<QuoteRow> {
	const cleaned = token.trim();
	if (cleaned.length < 8) {
		throw new NotFoundError('Takip kaydı bulunamadı');
	}

	return db.transaction(async (tx) => {
		const [workItem] = await tx
			.select()
			.from(workItems)
			.where(eq(workItems.publicToken, cleaned))
			.limit(1)
			.for('update');

		if (!workItem) {
			throw new NotFoundError('Takip kaydı bulunamadı');
		}

		const [quote] = await tx
			.select()
			.from(quotes)
			.where(and(eq(quotes.id, quoteId), eq(quotes.workItemId, workItem.id)))
			.limit(1);

		if (!quote) {
			throw new NotFoundError('Teklif bulunamadı');
		}
		if (quote.status === 'approved') {
			throw new ConflictError('Onaylanmış teklif reddedilemez');
		}
		if (quote.status !== 'sent') {
			throw new ValidationError('Yalnız gönderilmiş teklifler reddedilebilir');
		}

		const now = new Date();
		const [rejected] = await tx
			.update(quotes)
			.set({ status: 'rejected', updatedAt: now })
			.where(and(eq(quotes.id, quoteId), eq(quotes.status, 'sent')))
			.returning();

		if (!rejected) {
			throw new ConflictError('Teklif durumu eşzamanlı olarak değişti');
		}

		await tx.insert(workLogs).values({
			workItemId: workItem.id,
			actorId: null,
			type: 'quote',
			message: `Müşteri teklifi reddetti: ${rejected.quoteNo}`,
			isPublic: true
		});

		return rejected;
	});
}
