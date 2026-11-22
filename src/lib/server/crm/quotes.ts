import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { generateQuoteNo } from '$lib/domain/code';
import { calculateQuoteTotals, formatKurus } from '$lib/domain/money';
import { canTransition } from '$lib/domain/status';
import { requireAdmin } from '$lib/server/auth/guard';
import type { AuthUser } from '$lib/server/auth/types';
import type { Database } from '$lib/server/db/client';
import {
	customers,
	quoteItems,
	quotes,
	workItems,
	workLogs,
	type QuoteItemRow,
	type QuoteRow
} from '$lib/server/db/schema';
import { ConflictError, NotFoundError, ValidationError, isPgUniqueViolation } from './errors';

export class QuoteNotEditableError extends ConflictError {
	constructor(message = 'Yalnız taslak (draft) durumundaki teklifler düzenlenebilir') {
		super(message);
		this.name = 'QuoteNotEditableError';
	}
}

export class QuoteApprovalConflictError extends ConflictError {
	constructor(message = 'Bu iş kaydı için zaten onaylanmış bir teklif bulunuyor') {
		super(message);
		this.name = 'QuoteApprovalConflictError';
	}
}

const quoteItemInputSchema = z.object({
	kind: z.enum(['part', 'labor', 'service']).default('service'),
	description: z.string().trim().min(1, 'Kalem açıklaması zorunludur').max(240),
	qty: z.number().positive('Miktar sıfırdan büyük olmalıdır'),
	unitPriceKurus: z.number().int().min(0, 'Birim fiyat negatif olamaz'),
	vatRate: z.number().int().min(0).max(100).default(20)
});

export const createQuoteSchema = z.object({
	workItemId: z.number().int().positive(),
	vatIncluded: z.boolean().default(false),
	notes: z
		.string()
		.trim()
		.max(2000)
		.optional()
		.nullable()
		.transform((v) => (v && v.length > 0 ? v : null)),
	validUntil: z.date().nullable().optional(),
	items: z.array(quoteItemInputSchema).min(1, 'En az bir teklif kalemi gereklidir')
});

export const updateDraftQuoteSchema = z.object({
	vatIncluded: z.boolean().optional(),
	notes: z
		.string()
		.trim()
		.max(2000)
		.optional()
		.nullable()
		.transform((v) => (v && v.length > 0 ? v : null)),
	validUntil: z.date().nullable().optional(),
	items: z.array(quoteItemInputSchema).min(1, 'En az bir teklif kalemi gereklidir').optional()
});

export type CreateQuoteInput = z.input<typeof createQuoteSchema>;
export type UpdateDraftQuoteInput = z.input<typeof updateDraftQuoteSchema>;

export interface QuoteWithItems extends QuoteRow {
	items: QuoteItemRow[];
}

export async function createQuote(
	db: Database,
	user: AuthUser | null,
	input: CreateQuoteInput
): Promise<QuoteWithItems> {
	const authed = requireAdmin(user);
	const data = createQuoteSchema.parse(input);
	const calc = calculateQuoteTotals(data.items, data.vatIncluded);

	return db.transaction(async (tx) => {
		const [item] = await tx
			.select()
			.from(workItems)
			.where(eq(workItems.id, data.workItemId))
			.limit(1);

		if (!item) {
			throw new NotFoundError('İş kaydı bulunamadı');
		}

		const [maxRow] = await tx
			.select({ maxVersion: sql<number>`coalesce(max(${quotes.version}), 0)::int` })
			.from(quotes)
			.where(eq(quotes.workItemId, item.id));

		const nextVersion = (maxRow?.maxVersion ?? 0) + 1;
		const quoteNo = generateQuoteNo(item.code, nextVersion);

		const [createdQuote] = await tx
			.insert(quotes)
			.values({
				workItemId: item.id,
				quoteNo,
				version: nextVersion,
				status: 'draft',
				vatIncluded: data.vatIncluded,
				subtotalKurus: calc.subtotalKurus,
				vatTotalKurus: calc.vatTotalKurus,
				totalKurus: calc.totalKurus,
				notes: data.notes ?? null,
				validUntil: data.validUntil ?? null
			})
			.returning();

		const insertedItems = await tx
			.insert(quoteItems)
			.values(
				data.items.map((line, index) => ({
					quoteId: createdQuote.id,
					kind: line.kind,
					description: line.description,
					qty: line.qty.toFixed(2),
					unitPriceKurus: line.unitPriceKurus,
					vatRate: line.vatRate,
					lineSubtotalKurus: calc.lines[index].lineSubtotalKurus,
					lineVatKurus: calc.lines[index].lineVatKurus,
					lineTotalKurus: calc.lines[index].lineTotalKurus,
					sortOrder: index
				}))
			)
			.returning();

		await tx.insert(workLogs).values({
			workItemId: item.id,
			actorId: authed.id,
			type: 'quote',
			message: `Taslak teklif oluşturuldu: ${quoteNo} (${formatKurus(calc.totalKurus)})`,
			isPublic: false
		});

		return { ...createdQuote, items: insertedItems };
	});
}

export async function updateDraftQuote(
	db: Database,
	user: AuthUser | null,
	quoteId: number,
	input: UpdateDraftQuoteInput
): Promise<QuoteWithItems> {
	requireAdmin(user);
	const data = updateDraftQuoteSchema.parse(input);

	return db.transaction(async (tx) => {
		const [existing] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
		if (!existing) {
			throw new NotFoundError('Teklif bulunamadı');
		}
		if (existing.status !== 'draft') {
			throw new QuoteNotEditableError();
		}

		const currentItems = await tx
			.select()
			.from(quoteItems)
			.where(eq(quoteItems.quoteId, quoteId))
			.orderBy(asc(quoteItems.sortOrder), asc(quoteItems.id));

		const nextVatIncluded = data.vatIncluded ?? existing.vatIncluded;
		const nextItemsInput = data.items
			? data.items
			: currentItems.map((ci) => ({
					kind: ci.kind,
					description: ci.description,
					qty: Number(ci.qty),
					unitPriceKurus: ci.unitPriceKurus,
					vatRate: ci.vatRate
				}));

		const calc = calculateQuoteTotals(nextItemsInput, nextVatIncluded);

		const [updatedQuote] = await tx
			.update(quotes)
			.set({
				vatIncluded: nextVatIncluded,
				notes: data.notes !== undefined ? data.notes : existing.notes,
				validUntil: data.validUntil !== undefined ? data.validUntil : existing.validUntil,
				subtotalKurus: calc.subtotalKurus,
				vatTotalKurus: calc.vatTotalKurus,
				totalKurus: calc.totalKurus,
				updatedAt: new Date()
			})
			.where(eq(quotes.id, quoteId))
			.returning();

		await tx.delete(quoteItems).where(eq(quoteItems.quoteId, quoteId));
		const insertedItems = await tx
			.insert(quoteItems)
			.values(
				nextItemsInput.map((line, index) => ({
					quoteId,
					kind: line.kind,
					description: line.description,
					qty: line.qty.toFixed(2),
					unitPriceKurus: line.unitPriceKurus,
					vatRate: line.vatRate,
					lineSubtotalKurus: calc.lines[index].lineSubtotalKurus,
					lineVatKurus: calc.lines[index].lineVatKurus,
					lineTotalKurus: calc.lines[index].lineTotalKurus,
					sortOrder: index
				}))
			)
			.returning();

		return { ...updatedQuote, items: insertedItems };
	});
}

export async function sendQuote(
	db: Database,
	user: AuthUser | null,
	quoteId: number
): Promise<QuoteRow> {
	const authed = requireAdmin(user);

	return db.transaction(async (tx) => {
		const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
		if (!quote) {
			throw new NotFoundError('Teklif bulunamadı');
		}
		if (quote.status !== 'draft') {
			throw new ConflictError('Yalnız taslak teklifler gönderilebilir');
		}

		const [updated] = await tx
			.update(quotes)
			.set({ status: 'sent', updatedAt: new Date() })
			.where(eq(quotes.id, quoteId))
			.returning();

		const [workItem] = await tx
			.select()
			.from(workItems)
			.where(eq(workItems.id, quote.workItemId))
			.limit(1);

		if (workItem && workItem.status === 'new' && canTransition('new', 'quoted')) {
			await tx
				.update(workItems)
				.set({ status: 'quoted', updatedAt: new Date() })
				.where(eq(workItems.id, workItem.id));
		}

		await tx.insert(workLogs).values({
			workItemId: quote.workItemId,
			actorId: authed.id,
			type: 'quote',
			message: `Teklif gönderildi: ${quote.quoteNo} (${formatKurus(quote.totalKurus)})`,
			isPublic: true
		});

		return updated;
	});
}

export async function reviseQuote(
	db: Database,
	user: AuthUser | null,
	quoteId: number
): Promise<QuoteWithItems> {
	const authed = requireAdmin(user);

	return db.transaction(async (tx) => {
		const [source] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
		if (!source) {
			throw new NotFoundError('Teklif bulunamadı');
		}
		if (source.status === 'approved') {
			throw new ConflictError('Onaylanmış teklif revize edilemez');
		}

		const [workItem] = await tx
			.select()
			.from(workItems)
			.where(eq(workItems.id, source.workItemId))
			.limit(1);
		if (!workItem) {
			throw new NotFoundError('İş kaydı bulunamadı');
		}

		const sourceItems = await tx
			.select()
			.from(quoteItems)
			.where(eq(quoteItems.quoteId, source.id))
			.orderBy(asc(quoteItems.sortOrder), asc(quoteItems.id));

		if (source.status === 'draft' || source.status === 'sent') {
			await tx
				.update(quotes)
				.set({ status: 'rejected', updatedAt: new Date() })
				.where(eq(quotes.id, source.id));
		}

		const [maxRow] = await tx
			.select({ maxVersion: sql<number>`coalesce(max(${quotes.version}), 0)::int` })
			.from(quotes)
			.where(eq(quotes.workItemId, source.workItemId));

		const nextVersion = (maxRow?.maxVersion ?? source.version) + 1;
		const quoteNo = generateQuoteNo(workItem.code, nextVersion);

		const [newQuote] = await tx
			.insert(quotes)
			.values({
				workItemId: source.workItemId,
				quoteNo,
				version: nextVersion,
				status: 'draft',
				vatIncluded: source.vatIncluded,
				subtotalKurus: source.subtotalKurus,
				vatTotalKurus: source.vatTotalKurus,
				totalKurus: source.totalKurus,
				notes: source.notes,
				validUntil: source.validUntil
			})
			.returning();

		const copiedItems =
			sourceItems.length > 0
				? await tx
						.insert(quoteItems)
						.values(
							sourceItems.map((si, idx) => ({
								quoteId: newQuote.id,
								kind: si.kind,
								description: si.description,
								qty: si.qty,
								unitPriceKurus: si.unitPriceKurus,
								vatRate: si.vatRate,
								lineSubtotalKurus: si.lineSubtotalKurus,
								lineVatKurus: si.lineVatKurus,
								lineTotalKurus: si.lineTotalKurus,
								sortOrder: idx
							}))
						)
						.returning()
				: [];

		await tx.insert(workLogs).values({
			workItemId: source.workItemId,
			actorId: authed.id,
			type: 'quote',
			message: `Teklif revize edildi: ${source.quoteNo} → ${quoteNo}`,
			isPublic: false
		});

		return { ...newQuote, items: copiedItems };
	});
}

export async function approveQuote(
	db: Database,
	user: AuthUser | null,
	quoteId: number
): Promise<QuoteRow> {
	const authed = requireAdmin(user);

	try {
		return await db.transaction(async (tx) => {
			const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
			if (!quote) {
				throw new NotFoundError('Teklif bulunamadı');
			}
			if (quote.status === 'approved') {
				throw new QuoteApprovalConflictError();
			}
			if (quote.status !== 'draft' && quote.status !== 'sent') {
				throw new ValidationError('Yalnız taslak veya gönderilmiş teklifler onaylanabilir');
			}

			const [workItem] = await tx
				.select()
				.from(workItems)
				.where(eq(workItems.id, quote.workItemId))
				.limit(1);
			if (!workItem) {
				throw new NotFoundError('İş kaydı bulunamadı');
			}
			if (workItem.status === 'delivered' || workItem.status === 'cancelled') {
				throw new ValidationError('Teslim edilmiş veya iptal edilmiş işin teklifi onaylanamaz');
			}

			const now = new Date();
			// Kısmi tekil indeks (quotes_one_approved_per_work_item_idx) eşzamanlı çift onayı veritabanı seviyesinde engeller.
			const [approved] = await tx
				.update(quotes)
				.set({
					status: 'approved',
					approvedAt: now,
					updatedAt: now
				})
				.where(and(eq(quotes.id, quoteId), inArray(quotes.status, ['draft', 'sent'])))
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
				actorId: authed.id,
				type: 'quote',
				message: `Teklif onaylandı: ${approved.quoteNo} (${formatKurus(approved.totalKurus)})`,
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

export async function rejectQuote(
	db: Database,
	user: AuthUser | null,
	quoteId: number
): Promise<QuoteRow> {
	const authed = requireAdmin(user);

	return db.transaction(async (tx) => {
		const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
		if (!quote) {
			throw new NotFoundError('Teklif bulunamadı');
		}
		if (quote.status === 'approved') {
			throw new ConflictError('Onaylanmış teklif reddedilemez');
		}

		const [updated] = await tx
			.update(quotes)
			.set({ status: 'rejected', updatedAt: new Date() })
			.where(eq(quotes.id, quoteId))
			.returning();

		await tx.insert(workLogs).values({
			workItemId: quote.workItemId,
			actorId: authed.id,
			type: 'quote',
			message: `Teklif reddedildi: ${quote.quoteNo}`,
			isPublic: true
		});

		return updated;
	});
}

export async function getQuoteWithDetails(db: Database, user: AuthUser | null, quoteId: number) {
	requireAdmin(user);
	const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
	if (!quote) {
		throw new NotFoundError('Teklif bulunamadı');
	}

	const items = await db
		.select()
		.from(quoteItems)
		.where(eq(quoteItems.quoteId, quoteId))
		.orderBy(asc(quoteItems.sortOrder), asc(quoteItems.id));

	const [workItem] = await db
		.select()
		.from(workItems)
		.where(eq(workItems.id, quote.workItemId))
		.limit(1);

	const [customer] = workItem
		? await db.select().from(customers).where(eq(customers.id, workItem.customerId)).limit(1)
		: [undefined];

	return { quote, items, workItem, customer };
}
