import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InvalidStatusTransitionError } from '$lib/domain/status';
import type { AuthUser } from '$lib/server/auth/types';
import {
	createCustomer,
	deleteCustomer,
	getCustomerById,
	listCustomers,
	updateCustomer
} from '$lib/server/crm/customers';
import {
	addWorkLog,
	createWorkItem,
	getWorkItemDetail,
	transitionWorkItemStatus
} from '$lib/server/crm/work';
import type { Database } from '$lib/server/db/client';
import { workItems, workLogs } from '$lib/server/db/schema';
import { openTestDb, resetTestDb, seedTestUsers } from './helpers';

describe('müşteri + iş CRUD, durum geçişi ve work_logs (gerçek Postgres)', () => {
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

	it('müşteri CRUD işlemlerini gerçekleştirir', async () => {
		const created = await createCustomer(db, admin, {
			name: 'Mehmet Kaya',
			company: 'Kaya Bilişim',
			phone: '0533 222 33 44',
			email: 'mehmet@example.com',
			kind: 'lead'
		});
		expect(created.id).toBeGreaterThan(0);
		expect(created.phone).toBe('+905332223344');

		const updated = await updateCustomer(db, admin, created.id, {
			kind: 'active',
			notes: 'Kurumsal bakım anlaşması'
		});
		expect(updated.kind).toBe('active');
		expect(updated.notes).toBe('Kurumsal bakım anlaşması');

		const all = await listCustomers(db, admin);
		expect(all).toHaveLength(1);

		const fetched = await getCustomerById(db, admin, created.id);
		expect(fetched.name).toBe('Mehmet Kaya');

		await deleteCustomer(db, admin, created.id);
		expect(await listCustomers(db, admin)).toHaveLength(0);
	});

	it('iş kaydı work_type + Zod metadata doğrulamasıyla oluşur ve ilk log aynı transaction içinde yazılır', async () => {
		const customer = await createCustomer(db, admin, { name: 'Zeynep Acar', kind: 'active' });

		const item = await createWorkItem(db, admin, {
			customerId: customer.id,
			assignedTo: staff.id,
			workType: 'service',
			title: 'MacBook pil değişimi',
			priority: 'high',
			metadata: {
				device: 'Dizüstü Bilgisayar',
				brand: 'Apple',
				serialNo: 'SN-998877',
				accessories: 'Şarj adaptörü yok'
			}
		});

		expect(item.code).toMatch(/^TS-[A-Z0-9]{6}$/);
		expect(item.publicToken.length).toBeGreaterThanOrEqual(20);
		expect(item.status).toBe('new');
		expect(item.metadata).toMatchObject({ device: 'Dizüstü Bilgisayar', serialNo: 'SN-998877' });

		const logs = await db.select().from(workLogs).where(eq(workLogs.workItemId, item.id));
		expect(logs).toHaveLength(1);
		expect(logs[0].type).toBe('status');
		expect(logs[0].isPublic).toBe(true);

		// Ajans metadata'sında geçersiz URL reddedilir
		await expect(
			createWorkItem(db, admin, {
				customerId: customer.id,
				workType: 'agency',
				title: 'Sosyal medya kampanyası',
				metadata: {
					deliverableUrl: 'javascript:alert(1)'
				}
			})
		).rejects.toThrow();
	});

	it('geçerli durum geçişi work_items ve work_logs kayıtlarını aynı transaction içinde günceller; geçersiz geçişi reddeder', async () => {
		const customer = await createCustomer(db, admin, { name: 'Ali Veli', kind: 'active' });
		const item = await createWorkItem(db, admin, {
			customerId: customer.id,
			assignedTo: staff.id,
			workType: 'service',
			title: 'Yazıcı bakım'
		});

		// Geçersiz geçiş (new -> delivered) reddedilir, DB değişmez
		await expect(transitionWorkItemStatus(db, admin, item.id, 'delivered')).rejects.toThrow(
			InvalidStatusTransitionError
		);

		const afterInvalid = await db.select().from(workItems).where(eq(workItems.id, item.id));
		expect(afterInvalid[0].status).toBe('new');
		const logsAfterInvalid = await db
			.select()
			.from(workLogs)
			.where(eq(workLogs.workItemId, item.id));
		expect(logsAfterInvalid).toHaveLength(1); // sadece açılış logu

		// Geçerli zincir: new -> approved -> in_progress -> ready -> delivered
		await transitionWorkItemStatus(db, admin, item.id, 'approved', 'Müşteri onayladı');
		await transitionWorkItemStatus(db, staff, item.id, 'in_progress', 'Parça takılıyor');
		await transitionWorkItemStatus(db, staff, item.id, 'ready', 'Testler bitti');
		const delivered = await transitionWorkItemStatus(
			db,
			admin,
			item.id,
			'delivered',
			'Teslim edildi'
		);

		expect(delivered.status).toBe('delivered');
		expect(delivered.deliveredAt).toBeInstanceOf(Date);

		await addWorkLog(db, staff, item.id, {
			message: 'İç teknik not',
			isPublic: false
		});

		const detail = await getWorkItemDetail(db, admin, item.id);
		expect(detail.logs).toHaveLength(6); // 1 açılış + 4 geçiş + 1 not
		expect(detail.logs.filter((l) => l.type === 'status')).toHaveLength(5);
	});
});
