import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AUTH_COOKIE_NAME, signSessionCookie } from '$lib/server/auth/cookie';
import { AuthError } from '$lib/server/auth/guard';
import type { AuthUser } from '$lib/server/auth/types';
import { createCustomer, deleteCustomer } from '$lib/server/crm/customers';
import { addPayment } from '$lib/server/crm/payments';
import { approveQuote, createQuote } from '$lib/server/crm/quotes';
import {
	addWorkLog,
	createWorkItem,
	deleteWorkItem,
	getWorkItemById,
	listWorkItems,
	transitionWorkItemStatus
} from '$lib/server/crm/work';
import type { Database } from '$lib/server/db/client';
import { closeDb } from '$lib/server/db/client';
import { handle } from '../../src/hooks.server';
import { openTestDb, resetTestDb, seedTestUsers, TEST_DB_URL } from './helpers';

function createMockEvent(pathname: string, method: string, cookieValue?: string) {
	const store = new Map<string, string>();
	if (cookieValue) store.set(AUTH_COOKIE_NAME, cookieValue);
	return {
		url: new URL(`http://localhost${pathname}`),
		request: new Request(`http://localhost${pathname}`, { method }),
		locals: { user: null as AuthUser | null },
		cookies: {
			get: (name: string) => store.get(name),
			delete: (name: string) => store.delete(name)
		}
	};
}

describe('auth hooks & staff yetki sınırları (gerçek Postgres)', () => {
	let db: Database;
	let client: Awaited<ReturnType<typeof openTestDb>>['client'];
	let admin: AuthUser;
	let staff: AuthUser;
	let otherStaff: AuthUser;
	const prevDbUrl = process.env.DATABASE_URL;

	beforeAll(async () => {
		process.env.DATABASE_URL = TEST_DB_URL;
		await closeDb();
		const conn = await openTestDb();
		db = conn.db;
		client = conn.client;
	});

	beforeEach(async () => {
		await resetTestDb(db);
		const seeded = await seedTestUsers(db);
		admin = seeded.admin;
		staff = seeded.staff;
		otherStaff = seeded.otherStaff;
	});

	afterAll(async () => {
		await closeDb();
		await client.end();
		if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
		else process.env.DATABASE_URL = prevDbUrl;
	});

	it('hooks.server.ts: oturumsuz veya sahte cookie API isteklerinde 401, sayfalarda /giris redirect verir', async () => {
		const apiEvent = createMockEvent('/api/export', 'GET', 'sahte.cookie');
		const apiRes = await handle({
			event: apiEvent as never,
			resolve: async () => new Response('ok')
		});
		expect(apiRes.status).toBe(401);
		expect(apiEvent.locals.user).toBeNull();

		const pageEvent = createMockEvent('/isler', 'GET');
		await expect(
			handle({
				event: pageEvent as never,
				resolve: async () => new Response('ok')
			})
		).rejects.toMatchObject({ status: 303, location: '/giris' });
	});

	it('hooks.server.ts: staff /api/export isteğinde 403 alır, admin 200 geçer', async () => {
		const staffCookie = signSessionCookie({ userId: staff.id });
		const staffEvent = createMockEvent('/api/export', 'GET', staffCookie);
		const staffRes = await handle({
			event: staffEvent as never,
			resolve: async () => new Response('csv-ok', { status: 200 })
		});
		expect(staffRes.status).toBe(403);
		expect(staffEvent.locals.user?.role).toBe('staff');

		const adminCookie = signSessionCookie({ userId: admin.id });
		const adminEvent = createMockEvent('/api/export', 'GET', adminCookie);
		const adminRes = await handle({
			event: adminEvent as never,
			resolve: async () => new Response('csv-ok', { status: 200 })
		});
		expect(adminRes.status).toBe(200);
		expect(adminEvent.locals.user?.role).toBe('admin');
	});

	it('staff yalnız kendisine atanan işleri görür; atanmamış işi açamaz, ödeme/onay/silme yapamaz', async () => {
		const customer = await createCustomer(db, admin, {
			name: 'Ayşe Demir',
			phone: '0532 111 22 33',
			kind: 'active'
		});

		const assignedItem = await createWorkItem(db, admin, {
			customerId: customer.id,
			assignedTo: staff.id,
			workType: 'service',
			title: 'Laptop ekran değişimi'
		});
		const unassignedItem = await createWorkItem(db, admin, {
			customerId: customer.id,
			assignedTo: otherStaff.id,
			workType: 'service',
			title: 'Başkasına atanan anakart onarımı'
		});

		// Staff listesi yalnız kendi işini döner
		const staffList = await listWorkItems(db, staff);
		expect(staffList.map((w) => w.id)).toEqual([assignedItem.id]);

		// Admin hepsini görür
		const adminList = await listWorkItems(db, admin);
		expect(adminList).toHaveLength(2);

		// Staff atanmamış işi açamaz (403)
		await expect(getWorkItemById(db, staff, unassignedItem.id)).rejects.toMatchObject({
			name: AuthError.name,
			status: 403
		});

		// Staff atanan işi açabilir, not ekleyebilir ve durum değiştirebilir
		const opened = await getWorkItemById(db, staff, assignedItem.id);
		expect(opened.id).toBe(assignedItem.id);
		await addWorkLog(db, staff, assignedItem.id, {
			message: 'Ekran testi yapıldı',
			isPublic: false
		});
		await transitionWorkItemStatus(db, staff, assignedItem.id, 'quoted', 'Ön inceleme tamam');

		// Staff teklif onaylayamaz (403)
		const quote = await createQuote(db, admin, {
			workItemId: assignedItem.id,
			items: [
				{ kind: 'part', description: 'IPS Panel', qty: 1, unitPriceKurus: 2500_00, vatRate: 20 }
			]
		});
		await expect(approveQuote(db, staff, quote.id)).rejects.toMatchObject({
			name: AuthError.name,
			status: 403
		});

		// Staff ödeme ekleyemez (403)
		await expect(
			addPayment(db, staff, {
				workItemId: assignedItem.id,
				amountKurus: 500_00,
				method: 'cash'
			})
		).rejects.toMatchObject({
			name: AuthError.name,
			status: 403
		});

		// Staff iş veya müşteri silemez (403)
		await expect(deleteWorkItem(db, staff, assignedItem.id)).rejects.toMatchObject({
			name: AuthError.name,
			status: 403
		});
		await expect(deleteCustomer(db, staff, customer.id)).rejects.toMatchObject({
			name: AuthError.name,
			status: 403
		});
	});
});
