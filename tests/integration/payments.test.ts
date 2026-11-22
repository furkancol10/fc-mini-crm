import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AuthUser } from '$lib/server/auth/types';
import { createCustomer } from '$lib/server/crm/customers';
import { addPayment, deletePayment, getWorkItemPaymentSummary } from '$lib/server/crm/payments';
import { approveQuote, createQuote, sendQuote } from '$lib/server/crm/quotes';
import { createWorkItem } from '$lib/server/crm/work';
import type { Database } from '$lib/server/db/client';
import { workLogs } from '$lib/server/db/schema';
import { openTestDb, resetTestDb, seedTestUsers } from './helpers';

describe('tahsilat + türetilmiş bakiye (gerçek Postgres)', () => {
	let db: Database;
	let client: Awaited<ReturnType<typeof openTestDb>>['client'];
	let admin: AuthUser;

	beforeAll(async () => {
		const conn = await openTestDb();
		db = conn.db;
		client = conn.client;
	});

	beforeEach(async () => {
		await resetTestDb(db);
		const seeded = await seedTestUsers(db);
		admin = seeded.admin;
	});

	afterAll(async () => {
		await client.end();
	});

	it('kısmi ödeme → tam ödeme → silme sonrası türetilmiş bakiye ve durum her adımda doğrudur', async () => {
		const customer = await createCustomer(db, admin, { name: 'Burak Şahin', kind: 'active' });
		const item = await createWorkItem(db, admin, {
			customerId: customer.id,
			workType: 'service',
			title: 'SSD + RAM yükseltme'
		});

		// Onaylı teklif yokken
		const initial = await getWorkItemPaymentSummary(db, admin, item.id);
		expect(initial.balance.status).toBe('no_quote');
		expect(initial.balance.remainingKurus).toBe(0);

		// 1.200,00 TL toplamlı teklifi onayla (1.000 TL + %20 KDV)
		const quote = await createQuote(db, admin, {
			workItemId: item.id,
			items: [
				{ kind: 'part', description: '1TB NVMe SSD', qty: 1, unitPriceKurus: 1000_00, vatRate: 20 }
			]
		});
		await sendQuote(db, admin, quote.id);
		await approveQuote(db, admin, quote.id);

		const afterApprove = await getWorkItemPaymentSummary(db, admin, item.id);
		expect(afterApprove.balance.status).toBe('unpaid');
		expect(afterApprove.balance.approvedTotalKurus).toBe(1200_00);
		expect(afterApprove.balance.remainingKurus).toBe(1200_00);

		// Kısmi ödeme: 500,00 TL nakit
		const p1 = await addPayment(db, admin, {
			workItemId: item.id,
			amountKurus: 500_00,
			method: 'cash',
			invoiceRef: 'FTR-2026-001'
		});
		expect(p1.amountKurus).toBe(500_00);

		const afterPartial = await getWorkItemPaymentSummary(db, admin, item.id);
		expect(afterPartial.balance.status).toBe('partial');
		expect(afterPartial.balance.paidTotalKurus).toBe(500_00);
		expect(afterPartial.balance.remainingKurus).toBe(700_00);
		expect(afterPartial.payments).toHaveLength(1);

		// Tamamlayıcı ödeme: 700,00 TL havale
		const p2 = await addPayment(db, admin, {
			workItemId: item.id,
			amountKurus: 700_00,
			method: 'transfer',
			invoiceRef: 'FTR-2026-002'
		});

		const afterFull = await getWorkItemPaymentSummary(db, admin, item.id);
		expect(afterFull.balance.status).toBe('paid');
		expect(afterFull.balance.paidTotalKurus).toBe(1200_00);
		expect(afterFull.balance.remainingKurus).toBe(0);

		// Ödeme logları aynı transaction içinde yazılmış olmalı
		const logs = await db.select().from(workLogs).where(eq(workLogs.workItemId, item.id));
		const paymentLogs = logs.filter((l) => l.type === 'payment');
		expect(paymentLogs).toHaveLength(2);

		// İkinci ödemeyi sil -> tekrar kısmi ödemeye döner (çifte kaynak yok)
		await deletePayment(db, admin, p2.id);
		const afterDelete = await getWorkItemPaymentSummary(db, admin, item.id);
		expect(afterDelete.balance.status).toBe('partial');
		expect(afterDelete.balance.remainingKurus).toBe(700_00);
	});

	it('sıfır veya negatif ödeme tutarını reddeder', async () => {
		const customer = await createCustomer(db, admin, { name: 'Ece Aydın', kind: 'active' });
		const item = await createWorkItem(db, admin, {
			customerId: customer.id,
			workType: 'agency',
			title: 'Logo revizyonu'
		});

		await expect(
			addPayment(db, admin, { workItemId: item.id, amountKurus: 0, method: 'card' })
		).rejects.toThrow();
		await expect(
			addPayment(db, admin, { workItemId: item.id, amountKurus: -500, method: 'card' })
		).rejects.toThrow();
	});
});
