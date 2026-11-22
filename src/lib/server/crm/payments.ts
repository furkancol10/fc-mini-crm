import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { calculateBalance } from '$lib/domain/balance';
import { formatKurus } from '$lib/domain/money';
import { requireAdmin } from '$lib/server/auth/guard';
import type { AuthUser } from '$lib/server/auth/types';
import type { Database } from '$lib/server/db/client';
import { payments, quotes, workItems, workLogs, type PaymentRow } from '$lib/server/db/schema';
import { NotFoundError } from './errors';

export const PAYMENT_METHOD_LABELS: Record<'cash' | 'card' | 'transfer', string> = {
	cash: 'Nakit',
	card: 'Kart',
	transfer: 'Havale / EFT'
};

export const addPaymentSchema = z.object({
	workItemId: z.number().int().positive(),
	amountKurus: z.number().int().positive('Ödeme tutarı sıfırdan büyük olmalıdır'),
	method: z.enum(['cash', 'card', 'transfer']),
	invoiceRef: z
		.string()
		.trim()
		.max(80)
		.optional()
		.nullable()
		.transform((v) => (v && v.length > 0 ? v : null)),
	note: z
		.string()
		.trim()
		.max(500)
		.optional()
		.nullable()
		.transform((v) => (v && v.length > 0 ? v : null)),
	paidAt: z.date().optional()
});

export type AddPaymentInput = z.input<typeof addPaymentSchema>;

export async function addPayment(
	db: Database,
	user: AuthUser | null,
	input: AddPaymentInput
): Promise<PaymentRow> {
	const authed = requireAdmin(user);
	const data = addPaymentSchema.parse(input);

	return db.transaction(async (tx) => {
		const [item] = await tx
			.select({ id: workItems.id })
			.from(workItems)
			.where(eq(workItems.id, data.workItemId))
			.limit(1);

		if (!item) {
			throw new NotFoundError('İş kaydı bulunamadı');
		}

		const [created] = await tx
			.insert(payments)
			.values({
				workItemId: data.workItemId,
				amountKurus: data.amountKurus,
				method: data.method,
				invoiceRef: data.invoiceRef ?? null,
				note: data.note ?? null,
				paidAt: data.paidAt ?? new Date()
			})
			.returning();

		const refSuffix = created.invoiceRef ? ` · Belge: ${created.invoiceRef}` : '';
		await tx.insert(workLogs).values({
			workItemId: data.workItemId,
			actorId: authed.id,
			type: 'payment',
			message: `Tahsilat kaydedildi: ${formatKurus(created.amountKurus)} (${PAYMENT_METHOD_LABELS[created.method]})${refSuffix}`,
			isPublic: false
		});

		return created;
	});
}

export async function deletePayment(
	db: Database,
	user: AuthUser | null,
	paymentId: number
): Promise<void> {
	const authed = requireAdmin(user);

	await db.transaction(async (tx) => {
		const [deleted] = await tx.delete(payments).where(eq(payments.id, paymentId)).returning();

		if (!deleted) {
			throw new NotFoundError('Tahsilat kaydı bulunamadı');
		}

		await tx.insert(workLogs).values({
			workItemId: deleted.workItemId,
			actorId: authed.id,
			type: 'payment',
			message: `Tahsilat kaydı silindi: ${formatKurus(deleted.amountKurus)}`,
			isPublic: false
		});
	});
}

export async function getWorkItemPaymentSummary(
	db: Database,
	user: AuthUser | null,
	workItemId: number
) {
	requireAdmin(user);

	const [item] = await db
		.select({ id: workItems.id })
		.from(workItems)
		.where(eq(workItems.id, workItemId))
		.limit(1);

	if (!item) {
		throw new NotFoundError('İş kaydı bulunamadı');
	}

	const [approvedQuote] = await db
		.select({ totalKurus: quotes.totalKurus })
		.from(quotes)
		.where(and(eq(quotes.workItemId, workItemId), eq(quotes.status, 'approved')))
		.limit(1);

	const paymentRows = await db
		.select()
		.from(payments)
		.where(eq(payments.workItemId, workItemId))
		.orderBy(desc(payments.paidAt), desc(payments.id));

	const balance = calculateBalance({
		approvedTotalKurus: approvedQuote ? approvedQuote.totalKurus : null,
		paymentsKurus: paymentRows.map((p) => p.amountKurus)
	});

	return { payments: paymentRows, balance };
}
