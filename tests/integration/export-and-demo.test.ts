import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { calculateBalance } from '$lib/domain/balance';
import { ALL_WORK_STATUSES } from '$lib/domain/status';
import { AUTH_COOKIE_NAME, signSessionCookie } from '$lib/server/auth/cookie';
import type { AuthUser } from '$lib/server/auth/types';
import { createCustomer } from '$lib/server/crm/customers';
import { createWorkItem } from '$lib/server/crm/work';
import type { Database } from '$lib/server/db/client';
import { closeDb } from '$lib/server/db/client';
import { customers, payments, quotes, workItems } from '$lib/server/db/schema';
import { resetDemoData } from '$lib/server/demo/seed';
import { resetAllRateLimiters } from '$lib/server/rate-limit';
import { handle } from '../../src/hooks.server';
import { POST as demoResetPost } from '../../src/routes/api/demo-reset/+server';
import { GET as exportGet } from '../../src/routes/api/export/+server';
import { actions as panoActions } from '../../src/routes/pano/+page.server';
import { openTestDb, resetTestDb, seedTestUsers, TEST_DB_URL } from './helpers';

function createMockEvent(
	pathname: string,
	method: string,
	options?: {
		cookieValue?: string;
		headers?: Record<string, string>;
		user?: AuthUser | null;
		ip?: string;
	}
) {
	const store = new Map<string, string>();
	if (options?.cookieValue) store.set(AUTH_COOKIE_NAME, options.cookieValue);
	return {
		url: new URL(`http://localhost${pathname}`),
		request: new Request(`http://localhost${pathname}`, {
			method,
			headers: options?.headers
		}),
		locals: { user: options?.user ?? null },
		cookies: {
			get: (name: string) => store.get(name),
			delete: (name: string) => store.delete(name)
		},
		getClientAddress: () => options?.ip ?? '127.0.0.1'
	};
}

describe('CSV dışa aktarım ve deterministik demo seed / reset (gerçek Postgres)', () => {
	let db: Database;
	let client: Awaited<ReturnType<typeof openTestDb>>['client'];
	let admin: AuthUser;
	let staff: AuthUser;
	const prevDbUrl = process.env.DATABASE_URL;
	const prevResetSecret = process.env.DEMO_RESET_SECRET;

	beforeAll(async () => {
		process.env.DATABASE_URL = TEST_DB_URL;
		process.env.DEMO_RESET_SECRET = 'test-secret-demo-reset-key-123456';
		await closeDb();
		const conn = await openTestDb();
		db = conn.db;
		client = conn.client;
	});

	beforeEach(async () => {
		resetAllRateLimiters();
		await resetTestDb(db);
		const seeded = await seedTestUsers(db);
		admin = seeded.admin;
		staff = seeded.staff;
	});

	afterAll(async () => {
		await closeDb();
		await client.end();
		if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
		else process.env.DATABASE_URL = prevDbUrl;
		if (prevResetSecret === undefined) delete process.env.DEMO_RESET_SECRET;
		else process.env.DEMO_RESET_SECRET = prevResetSecret;
	});

	it('GET /api/export: staff 403 alır; admin BOM + ; + formül kaçışlı CSV alır', async () => {
		const customer = await createCustomer(db, admin, {
			name: '=HYPERLINK("http://evil")',
			company: '+Tehlikeli Firma',
			kind: 'active'
		});
		await createWorkItem(db, admin, {
			customerId: customer.id,
			workType: 'service',
			title: '-Formül Başlık @test'
		});

		// Staff doğrudan handler'da 403 alır
		const staffRes = await exportGet(
			createMockEvent('/api/export?type=work_items', 'GET', { user: staff }) as never
		);
		expect(staffRes.status).toBe(403);

		// Admin CSV alır
		const adminRes = await exportGet(
			createMockEvent('/api/export?type=work_items', 'GET', { user: admin }) as never
		);
		expect(adminRes.status).toBe(200);
		expect(adminRes.headers.get('content-type')).toContain('text/csv');

		const rawBytes = new Uint8Array(await adminRes.arrayBuffer());
		// UTF-8 BOM (EF BB BF) ham bayt seviyesinde doğrulanır (Fetch res.text() BOM'u soyar)
		expect(Array.from(rawBytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);

		const body = new TextDecoder('utf-8', { ignoreBOM: true }).decode(rawBytes);
		expect(body.startsWith('\uFEFF')).toBe(true);
		expect(body).toContain(';');
		// Formül kaçışı doğrulanır
		expect(body).toContain("'-Formül Başlık @test");
		expect(body).toContain('"\'=HYPERLINK(""http://evil"")"');

		// Müşteri CSV de çalışır
		const custRes = await exportGet(
			createMockEvent('/api/export?type=customers', 'GET', { user: admin }) as never
		);
		expect(custRes.status).toBe(200);
		const custBody = await custRes.text();
		expect(custBody).toContain("'+Tehlikeli Firma");
	});

	it('POST /api/demo-reset: secret header koruması, deterministik başlangıç verisi ve hız sınırı', async () => {
		// Oturumsuz çağrı hooks.server.ts'ten /api/demo-reset'e geçmeli (401 oturum yerine secret kontrolüne girmeli)
		const unauthHookEvent = createMockEvent('/api/demo-reset', 'POST');
		const hookPassed = await handle({
			event: unauthHookEvent as never,
			resolve: async () => new Response('reached-handler', { status: 200 })
		});
		expect(hookPassed.status).toBe(200);

		// Yanlış / eksik secret 401 döner
		const noSecretRes = await demoResetPost(createMockEvent('/api/demo-reset', 'POST') as never);
		expect(noSecretRes.status).toBe(401);

		const badSecretRes = await demoResetPost(
			createMockEvent('/api/demo-reset', 'POST', {
				headers: { 'x-demo-reset-secret': 'yanlis-anahtar' }
			}) as never
		);
		expect(badSecretRes.status).toBe(401);

		// Önce ekstra kirli veri ekleyelim, reset sonrası temizlenip başlangıç verisi kurulmalı
		await createCustomer(db, admin, { name: 'Silinecek Kirli Kayıt', kind: 'lead' });

		const okRes = await demoResetPost(
			createMockEvent('/api/demo-reset', 'POST', {
				headers: { 'x-demo-reset-secret': 'test-secret-demo-reset-key-123456' }
			}) as never
		);
		expect(okRes.status).toBe(200);

		const allCustomers = await db.select().from(customers);
		const allItems = await db.select().from(workItems);
		const allQuotes = await db.select().from(quotes);
		const allPayments = await db.select().from(payments);

		// ~8 müşteri, ~14 iş (7 servis + 7 ajans)
		expect(allCustomers).toHaveLength(8);
		expect(allItems).toHaveLength(14);
		expect(allItems.filter((w) => w.workType === 'service')).toHaveLength(7);
		expect(allItems.filter((w) => w.workType === 'agency')).toHaveLength(7);

		// Her durumdan en az 1 iş var
		const presentStatuses = new Set(allItems.map((w) => w.status));
		for (const st of ALL_WORK_STATUSES) {
			expect(presentStatuses.has(st)).toBe(true);
		}

		// 2 gecikmiş aktif iş
		const now = new Date();
		const overdue = allItems.filter(
			(w) =>
				w.status !== 'delivered' &&
				w.status !== 'cancelled' &&
				w.dueDate !== null &&
				w.dueDate.getTime() < now.getTime()
		);
		expect(overdue).toHaveLength(2);

		// En az 1 kısmi ödemeli iş
		const partialItems = allItems.filter((w) => {
			const approvedQ = allQuotes.find((q) => q.workItemId === w.id && q.status === 'approved');
			const itemPayments = allPayments
				.filter((p) => p.workItemId === w.id)
				.map((p) => p.amountKurus);
			const bal = calculateBalance({
				approvedTotalKurus: approvedQ ? approvedQ.totalKurus : null,
				paymentsKurus: itemPayments
			});
			return bal.status === 'partial';
		});
		expect(partialItems.length).toBeGreaterThanOrEqual(1);

		// En az 1 revizyonlu teklif (aynı işte version >= 2)
		const hasRevised = allQuotes.some((q) => q.version >= 2);
		expect(hasRevised).toBe(true);

		// Kirli veri silinmiş, Visbody yok
		const dump = JSON.stringify({ allCustomers, allItems, allQuotes });
		expect(dump).not.toContain('Silinecek Kirli Kayıt');
		expect(dump.toLowerCase()).not.toContain('visbody');

		// Determinizm: tekrar resetDemoData aynı kodları ve tokenları üretir
		const firstCodes = allItems.map((w) => w.code).sort();
		await resetDemoData(db, now);
		const afterSecond = await db.select().from(workItems);
		expect(afterSecond.map((w) => w.code).sort()).toEqual(firstCodes);

		// Hız sınırı: ardışık istekler 429 verir
		let hit429 = false;
		for (let i = 0; i < 10; i++) {
			const res = await demoResetPost(
				createMockEvent('/api/demo-reset', 'POST', {
					headers: { 'x-demo-reset-secret': 'test-secret-demo-reset-key-123456' },
					ip: '10.0.0.99'
				}) as never
			);
			if (res.status === 429) {
				hit429 = true;
				break;
			}
		}
		expect(hit429).toBe(true);

		// Admin çerezli oturum hooks.server.ts ile /api/export geçer (regresyon)
		const adminCookie = signSessionCookie({ userId: 1 });
		const exportHookRes = await handle({
			event: createMockEvent('/api/export', 'GET', { cookieValue: adminCookie }) as never,
			resolve: async () => new Response('ok', { status: 200 })
		});
		expect(exportHookRes.status).toBe(200);

		// Panel butonu (pano ?/resetDemo): staff 403 alır, admin sıfırlar ve hız sınırı 429 verir
		const staffPanelRes = await panoActions.resetDemo(
			createMockEvent('/pano?/resetDemo', 'POST', { user: staff, ip: '10.0.0.50' }) as never
		);
		expect(staffPanelRes).toMatchObject({ status: 403 });

		const adminPanelRes = await panoActions.resetDemo(
			createMockEvent('/pano?/resetDemo', 'POST', { user: admin, ip: '10.0.0.51' }) as never
		);
		expect(adminPanelRes).toMatchObject({
			success: expect.stringContaining('Demo verisi sıfırlandı')
		});

		let panelHit429 = false;
		for (let i = 0; i < 5; i++) {
			const r = await panoActions.resetDemo(
				createMockEvent('/pano?/resetDemo', 'POST', { user: admin, ip: '10.0.0.51' }) as never
			);
			if (r && typeof r === 'object' && 'status' in r && r.status === 429) {
				panelHit429 = true;
				break;
			}
		}
		expect(panelHit429).toBe(true);
	});
});
