import { desc, eq, inArray } from 'drizzle-orm';
import { calculateBalance, getPaymentStatusLabel } from '$lib/domain/balance';
import { toCsv } from '$lib/domain/csv';
import { formatTrPhone } from '$lib/domain/phone';
import { getStatusLabel } from '$lib/domain/status';
import { AuthError, requireAdmin } from '$lib/server/auth/guard';
import { listCustomers } from '$lib/server/crm/customers';
import { PAYMENT_METHOD_LABELS } from '$lib/server/crm/payments';
import { listWorkItems } from '$lib/server/crm/work';
import { parseWorkItemQuery } from '$lib/server/crm/work-filters';
import { getDb } from '$lib/server/db/client';
import { customers, payments, quotes, workItems } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const PRIORITY_LABELS: Record<'low' | 'normal' | 'high', string> = {
	low: 'Düşük',
	normal: 'Normal',
	high: 'Yüksek'
};

function formatDateIso(d: Date | null | undefined): string {
	if (!d) return '';
	return d.toISOString().slice(0, 10);
}

function formatTlPlain(kurus: number): string {
	return (kurus / 100).toFixed(2).replace('.', ',');
}

export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		requireAdmin(locals.user);
	} catch (err) {
		if (err instanceof AuthError) {
			return new Response(JSON.stringify({ error: err.message }), {
				status: err.status,
				headers: { 'content-type': 'application/json' }
			});
		}
		throw err;
	}

	const db = getDb();
	const exportType = url.searchParams.get('type') ?? 'work_items';
	const today = new Date().toISOString().slice(0, 10);

	if (exportType === 'customers') {
		const rows = await listCustomers(db, locals.user);
		const csv = toCsv(
			['Ad Soyad', 'Firma', 'Telefon', 'E-posta', 'Vergi No', 'Tür', 'Oluşturulma'],
			rows.map((c) => [
				c.name,
				c.company ?? '',
				c.phone ? formatTrPhone(c.phone) : '',
				c.email ?? '',
				c.taxNo ?? '',
				c.kind === 'active' ? 'Aktif' : 'Aday',
				formatDateIso(c.createdAt)
			])
		);
		return new Response(csv, {
			status: 200,
			headers: {
				'content-type': 'text/csv; charset=utf-8',
				'content-disposition': `attachment; filename="musteriler-${today}.csv"`,
				'cache-control': 'no-store'
			}
		});
	}

	if (exportType === 'payments') {
		const paymentRows = await db
			.select({
				workCode: workItems.code,
				workTitle: workItems.title,
				customerName: customers.name,
				paidAt: payments.paidAt,
				method: payments.method,
				amountKurus: payments.amountKurus,
				invoiceRef: payments.invoiceRef,
				note: payments.note
			})
			.from(payments)
			.innerJoin(workItems, eq(payments.workItemId, workItems.id))
			.innerJoin(customers, eq(workItems.customerId, customers.id))
			.orderBy(desc(payments.paidAt), desc(payments.id));

		const csv = toCsv(
			['İş Kodu', 'İş Başlığı', 'Müşteri', 'Tarih', 'Yöntem', 'Tutar (TL)', 'Belge No', 'Not'],
			paymentRows.map((p) => [
				p.workCode,
				p.workTitle,
				p.customerName,
				formatDateIso(p.paidAt),
				PAYMENT_METHOD_LABELS[p.method] ?? p.method,
				formatTlPlain(p.amountKurus),
				p.invoiceRef ?? '',
				p.note ?? ''
			])
		);
		return new Response(csv, {
			status: 200,
			headers: {
				'content-type': 'text/csv; charset=utf-8',
				'content-disposition': `attachment; filename="tahsilatlar-${today}.csv"`,
				'cache-control': 'no-store'
			}
		});
	}

	// Varsayılan: work_items (aktif URL filtreleriyle uyumlu)
	const { filters } = parseWorkItemQuery(url.searchParams);
	const items = await listWorkItems(db, locals.user, filters);
	const itemIds = items.map((w) => w.id);

	const approvedByWork = new Map<number, number>();
	if (itemIds.length > 0) {
		const qRows = await db
			.select({
				workItemId: quotes.workItemId,
				status: quotes.status,
				totalKurus: quotes.totalKurus
			})
			.from(quotes)
			.where(inArray(quotes.workItemId, itemIds));
		for (const q of qRows) {
			if (q.status === 'approved') {
				approvedByWork.set(q.workItemId, q.totalKurus);
			}
		}
	}

	const paymentsByWork = new Map<number, number[]>();
	if (itemIds.length > 0) {
		const pRows = await db
			.select({ workItemId: payments.workItemId, amountKurus: payments.amountKurus })
			.from(payments)
			.where(inArray(payments.workItemId, itemIds));
		for (const p of pRows) {
			const arr = paymentsByWork.get(p.workItemId) ?? [];
			arr.push(p.amountKurus);
			paymentsByWork.set(p.workItemId, arr);
		}
	}

	const csv = toCsv(
		[
			'Kod',
			'Başlık',
			'Sektör',
			'Durum',
			'Öncelik',
			'Müşteri',
			'Atanan',
			'Termin',
			'Onaylı Teklif (TL)',
			'Tahsilat (TL)',
			'Kalan (TL)',
			'Ödeme Durumu',
			'Oluşturulma'
		],
		items.map((w) => {
			const approvedTotal = approvedByWork.has(w.id) ? (approvedByWork.get(w.id) ?? null) : null;
			const bal = calculateBalance({
				approvedTotalKurus: approvedTotal,
				paymentsKurus: paymentsByWork.get(w.id) ?? []
			});
			return [
				w.code,
				w.title,
				w.workType === 'service' ? 'Teknik Servis' : 'Ajans',
				getStatusLabel(w.status, w.workType),
				PRIORITY_LABELS[w.priority],
				w.customerName,
				w.assigneeName ?? '',
				formatDateIso(w.dueDate),
				bal.hasApprovedQuote ? formatTlPlain(bal.approvedTotalKurus) : '',
				formatTlPlain(bal.paidTotalKurus),
				bal.hasApprovedQuote ? formatTlPlain(bal.remainingKurus) : '',
				getPaymentStatusLabel(bal.status),
				formatDateIso(w.createdAt)
			];
		})
	);

	return new Response(csv, {
		status: 200,
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="isler-${today}.csv"`,
			'cache-control': 'no-store'
		}
	});
};
