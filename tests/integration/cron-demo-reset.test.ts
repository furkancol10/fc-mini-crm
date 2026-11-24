import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthUser } from '$lib/server/auth/types';
import { createCustomer } from '$lib/server/crm/customers';
import { closeDb } from '$lib/server/db/client';
import type { Database } from '$lib/server/db/client';
import { customers, workItems } from '$lib/server/db/schema';
import { handle } from '../../src/hooks.server';
import { GET as cronGet } from '../../src/routes/api/cron/demo-reset/+server';
import { openTestDb, resetTestDb, seedTestUsers, TEST_DB_URL } from './helpers';

const CRON_SECRET = 'test-cron-secret-key-1234567890';

function cronEvent(headers?: Record<string, string>) {
	return {
		url: new URL('http://localhost/api/cron/demo-reset'),
		request: new Request('http://localhost/api/cron/demo-reset', { method: 'GET', headers }),
		locals: { user: null },
		cookies: { get: () => undefined, delete: () => true },
		getClientAddress: () => '127.0.0.1'
	};
}

describe('GET /api/cron/demo-reset (Vercel Cron, gerçek Postgres)', () => {
	let db: Database;
	let client: Awaited<ReturnType<typeof openTestDb>>['client'];
	let admin: AuthUser;
	const prevDbUrl = process.env.DATABASE_URL;
	const prevCron = process.env.CRON_SECRET;

	beforeAll(async () => {
		process.env.DATABASE_URL = TEST_DB_URL;
		await closeDb();
		const conn = await openTestDb();
		db = conn.db;
		client = conn.client;
		await resetTestDb(db);
		({ admin } = await seedTestUsers(db));
	});

	afterAll(async () => {
		if (prevCron === undefined) delete process.env.CRON_SECRET;
		else process.env.CRON_SECRET = prevCron;
		if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
		else process.env.DATABASE_URL = prevDbUrl;
		await closeDb();
		await client.end();
	});

	it('CRON_SECRET tanımsızsa 503 döner', async () => {
		delete process.env.CRON_SECRET;
		const res = await cronGet(cronEvent({ authorization: `Bearer ${CRON_SECRET}` }) as never);
		expect(res.status).toBe(503);
	});

	it('eksik veya yanlış bearer 401 döner ve veriye dokunmaz', async () => {
		process.env.CRON_SECRET = CRON_SECRET;
		await createCustomer(db, admin, { name: 'Cron Kirli Kayıt', kind: 'lead' });

		expect((await cronGet(cronEvent() as never)).status).toBe(401);
		expect(
			(await cronGet(cronEvent({ authorization: 'Bearer yanlis-anahtar' }) as never)).status
		).toBe(401);
		expect((await cronGet(cronEvent({ authorization: CRON_SECRET }) as never)).status).toBe(401);

		const names = (await db.select().from(customers)).map((c) => c.name);
		expect(names).toContain('Cron Kirli Kayıt');
	});

	it('doğru bearer ile 200 döner, oturumsuz hook geçer ve demo verisi geri yüklenir', async () => {
		process.env.CRON_SECRET = CRON_SECRET;
		const hookPassed = await handle({
			event: cronEvent() as never,
			resolve: async () => new Response('reached-handler', { status: 200 })
		});
		expect(hookPassed.status).toBe(200);

		await createCustomer(db, admin, { name: 'Cron Kirli Kayıt 2', kind: 'lead' });
		const res = await cronGet(cronEvent({ authorization: `Bearer ${CRON_SECRET}` }) as never);
		expect(res.status).toBe(200);
		expect((await res.json()).ok).toBe(true);

		const allCustomers = await db.select().from(customers);
		expect(allCustomers).toHaveLength(8);
		expect(allCustomers.map((c) => c.name)).not.toContain('Cron Kirli Kayıt 2');
		expect(await db.select().from(workItems)).toHaveLength(14);
	});
});
