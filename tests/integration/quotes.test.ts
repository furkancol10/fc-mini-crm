import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AuthUser } from '$lib/server/auth/types';
import { createCustomer } from '$lib/server/crm/customers';
import {
	QuoteApprovalConflictError,
	QuoteNotEditableError,
	approveQuote,
	createQuote,
	reviseQuote,
	sendQuote,
	updateDraftQuote
} from '$lib/server/crm/quotes';
import { createWorkItem } from '$lib/server/crm/work';
import type { Database } from '$lib/server/db/client';
import { quotes, workItems, workLogs } from '$lib/server/db/schema';
import { openTestDb, resetTestDb, seedTestUsers } from './helpers';

describe('teklifler: kalemler, KDV, revizyon ve paralel tek onay (gerçek Postgres)', () => {
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

	it('taslak teklif oluşturur, KDV hariç/dahil hesaplar, yalnız draft durumda düzenlenir ve revize edilir', async () => {
		const customer = await createCustomer(db, admin, { name: 'Selin Kurt', kind: 'active' });
		const item = await createWorkItem(db, admin, {
			customerId: customer.id,
			workType: 'agency',
			title: 'Kurumsal web sitesi yenileme'
		});

		const draft = await createQuote(db, admin, {
			workItemId: item.id,
			items: [
				{
					kind: 'service',
					description: 'UI/UX Tasarım',
					qty: 1,
					unitPriceKurus: 10000_00,
					vatRate: 20
				},
				{
					kind: 'labor',
					description: 'Geliştirme (saat)',
					qty: 10,
					unitPriceKurus: 500_00,
					vatRate: 20
				}
			]
		});

		expect(draft.version).toBe(1);
		expect(draft.status).toBe('draft');
		expect(draft.vatIncluded).toBe(false);
		expect(draft.subtotalKurus).toBe(15000_00);
		expect(draft.vatTotalKurus).toBe(3000_00);
		expect(draft.totalKurus).toBe(18000_00);

		// Taslak düzenleme (KDV dahil moda geçiş)
		const updated = await updateDraftQuote(db, admin, draft.id, {
			vatIncluded: true,
			items: [
				{
					kind: 'service',
					description: 'Paket Web Sitesi',
					qty: 1,
					unitPriceKurus: 12000_00,
					vatRate: 20
				}
			]
		});
		expect(updated.vatIncluded).toBe(true);
		expect(updated.totalKurus).toBe(12000_00);
		expect(updated.subtotalKurus).toBe(10000_00);
		expect(updated.vatTotalKurus).toBe(2000_00);

		// Gönder -> iş durumu new -> quoted olur
		const sent = await sendQuote(db, admin, draft.id);
		expect(sent.status).toBe('sent');
		const [workAfterSend] = await db.select().from(workItems).where(eq(workItems.id, item.id));
		expect(workAfterSend.status).toBe('quoted');

		// Gönderilmiş teklif artık düzenlenemez
		await expect(
			updateDraftQuote(db, admin, draft.id, {
				items: [
					{
						kind: 'service',
						description: 'Değişiklik',
						qty: 1,
						unitPriceKurus: 100_00,
						vatRate: 20
					}
				]
			})
		).rejects.toThrow(QuoteNotEditableError);

		// Revizyon: v2 draft oluşur, v1 rejected olur
		const revised = await reviseQuote(db, admin, draft.id);
		expect(revised.version).toBe(2);
		expect(revised.status).toBe('draft');
		expect(revised.totalKurus).toBe(12000_00);
		expect(revised.items).toHaveLength(1);

		const [v1AfterRevise] = await db.select().from(quotes).where(eq(quotes.id, draft.id));
		expect(v1AfterRevise.status).toBe('rejected');

		// v2 gönder ve onayla -> iş durumu approved + log aynı transaction
		await sendQuote(db, admin, revised.id);
		const approved = await approveQuote(db, admin, revised.id);
		expect(approved.status).toBe('approved');
		expect(approved.approvedAt).toBeInstanceOf(Date);

		const [workAfterApprove] = await db.select().from(workItems).where(eq(workItems.id, item.id));
		expect(workAfterApprove.status).toBe('approved');

		const logs = await db.select().from(workLogs).where(eq(workLogs.workItemId, item.id));
		expect(logs.some((l) => l.type === 'quote' && l.message.includes('onaylandı'))).toBe(true);
	});

	it('paralel iki teklif onayında kısmi tekil indeks tam 1 başarıya izin verir', async () => {
		const customer = await createCustomer(db, admin, { name: 'Caner Yılmaz', kind: 'active' });
		const item = await createWorkItem(db, admin, {
			customerId: customer.id,
			workType: 'service',
			title: 'Anakart arıza tespiti'
		});

		const q1 = await createQuote(db, admin, {
			workItemId: item.id,
			items: [
				{ kind: 'part', description: 'Seçenek A', qty: 1, unitPriceKurus: 3000_00, vatRate: 20 }
			]
		});
		const q2 = await createQuote(db, admin, {
			workItemId: item.id,
			items: [
				{ kind: 'part', description: 'Seçenek B', qty: 1, unitPriceKurus: 4000_00, vatRate: 20 }
			]
		});

		await sendQuote(db, admin, q1.id);
		await sendQuote(db, admin, q2.id);

		const results = await Promise.allSettled([
			approveQuote(db, admin, q1.id),
			approveQuote(db, admin, q2.id)
		]);

		const fulfilled = results.filter((r) => r.status === 'fulfilled');
		const rejected = results.filter((r) => r.status === 'rejected');

		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
			QuoteApprovalConflictError
		);

		const approvedRows = await db
			.select()
			.from(quotes)
			.where(and(eq(quotes.workItemId, item.id), eq(quotes.status, 'approved')));
		expect(approvedRows).toHaveLength(1);
	});

	it('kısmi tekil indeks kaldırıldığında paralel iki onay yarışında DB çift onaya izin verir (indeks gereklilik kanıtı)', async () => {
		// Önce indeksin şemada tanımlı olduğunu doğrula
		const idxRows = await db.execute(
			sql`SELECT indexname FROM pg_indexes WHERE tablename = 'quotes' AND indexname = 'quotes_one_approved_per_work_item_idx'`
		);
		expect(idxRows).toHaveLength(1);

		const customer = await createCustomer(db, admin, { name: 'Deniz Öztürk', kind: 'active' });
		const item = await createWorkItem(db, admin, {
			customerId: customer.id,
			workType: 'service',
			title: 'Yarış koşulu doğrulama'
		});

		const q1 = await createQuote(db, admin, {
			workItemId: item.id,
			items: [
				{ kind: 'service', description: 'Teklif 1', qty: 1, unitPriceKurus: 1000_00, vatRate: 20 }
			]
		});
		const q2 = await createQuote(db, admin, {
			workItemId: item.id,
			items: [
				{ kind: 'service', description: 'Teklif 2', qty: 1, unitPriceKurus: 1500_00, vatRate: 20 }
			]
		});
		await sendQuote(db, admin, q1.id);
		await sendQuote(db, admin, q2.id);

		// İndeksi geçici olarak kaldır, paralel onayın indekssiz 2 başarıya (çift onay hatasına) yol açtığını kanıtla, sonra kesinlikle geri oluştur
		await db.execute(sql`DROP INDEX "quotes_one_approved_per_work_item_idx"`);
		try {
			const results = await Promise.allSettled([
				approveQuote(db, admin, q1.id),
				approveQuote(db, admin, q2.id)
			]);
			const fulfilled = results.filter((r) => r.status === 'fulfilled');
			// İndeks olmadan iki onay da geçer -> indeks olmadan "tam 1 başarı" testi FAIL eder
			expect(fulfilled.length).toBe(2);
		} finally {
			// Çift onaylı test verisini temizle ve kısmi tekil indeksi geri kur
			await resetTestDb(db);
			await db.execute(
				sql`CREATE UNIQUE INDEX "quotes_one_approved_per_work_item_idx" ON "quotes" USING btree ("work_item_id") WHERE "quotes"."status" = 'approved'`
			);
		}
	});
});
