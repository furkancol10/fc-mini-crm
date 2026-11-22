import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InvalidStatusTransitionError } from '$lib/domain/status';
import type { AuthUser } from '$lib/server/auth/types';
import { createCustomer } from '$lib/server/crm/customers';
import { createWorkItem, transitionWorkItemStatus } from '$lib/server/crm/work';
import type { Database } from '$lib/server/db/client';
import { workItems, workLogs } from '$lib/server/db/schema';
import { openTestDb, resetTestDb, seedTestUsers } from './helpers';

describe('eşzamanlı durum geçişi (gerçek Postgres)', () => {
	let db: Database;
	let client: Awaited<ReturnType<typeof openTestDb>>['client'];
	let admin: AuthUser;
	let staff: AuthUser;

	beforeAll(async () => {
		const conn = await openTestDb();
		db = conn.db;
		client = conn.client;
	});

	beforeEach(async () => {
		await resetTestDb(db);
		const seeded = await seedTestUsers(db);
		admin = seeded.admin;
		staff = seeded.staff;
	});

	afterAll(async () => {
		await client.end();
	});

	it('ready durumundaki işe paralel delivered ve in_progress geçişinden tam biri başarılı olur', async () => {
		const customer = await createCustomer(db, admin, { name: 'Yarış Testi', kind: 'active' });

		for (let i = 0; i < 20; i++) {
			const item = await createWorkItem(db, admin, {
				customerId: customer.id,
				assignedTo: staff.id,
				workType: 'service',
				title: `Yarış ${i}`,
				metadata: { device: 'Telefon', brand: 'X', serialNo: `SN-${i}`, accessories: '' }
			});
			for (const s of ['approved', 'in_progress', 'ready'] as const) {
				await transitionWorkItemStatus(db, admin, item.id, s);
			}
			const logsBefore = (await db.select().from(workLogs).where(eq(workLogs.workItemId, item.id)))
				.length;

			const results = await Promise.allSettled([
				transitionWorkItemStatus(db, admin, item.id, 'delivered'),
				transitionWorkItemStatus(db, admin, item.id, 'in_progress')
			]);

			const ok = results.filter((r) => r.status === 'fulfilled');
			const bad = results.filter((r) => r.status === 'rejected');
			expect(ok).toHaveLength(1);
			expect(bad).toHaveLength(1);
			expect((bad[0] as PromiseRejectedResult).reason).toBeInstanceOf(InvalidStatusTransitionError);

			const [final] = await db.select().from(workItems).where(eq(workItems.id, item.id));
			expect(final.status).toBe((ok[0] as PromiseFulfilledResult<{ status: string }>).value.status);
			const logsAfter = await db.select().from(workLogs).where(eq(workLogs.workItemId, item.id));
			expect(logsAfter.length - logsBefore).toBe(1);
		}
	});
});
