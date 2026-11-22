import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuthError } from '$lib/server/auth/guard';
import type { AuthUser } from '$lib/server/auth/types';
import { createCustomer } from '$lib/server/crm/customers';
import { getDashboardSummary, getFinancialKpis } from '$lib/server/crm/dashboard';
import { approveQuote, createQuote, sendQuote } from '$lib/server/crm/quotes';
import {
	addWorkLog,
	createWorkItem,
	listWorkItems,
	transitionWorkItemStatus
} from '$lib/server/crm/work';
import type { Database } from '$lib/server/db/client';
import { openTestDb, resetTestDb, seedTestUsers } from './helpers';

describe('pano 4 KPI, son 10 log ve filtreli iş listesi (gerçek Postgres)', () => {
	let db: Database;
	let client: Awaited<ReturnType<typeof openTestDb>>['client'];
	let admin: AuthUser;
	let staff: AuthUser;
	let otherStaff: AuthUser;

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
		otherStaff = seeded.otherStaff;
	});

	afterAll(async () => {
		await client.end();
	});

	it('admin 4 KPI ve son 10 logu doğru hesaplar; staff tutar KPI göremez ve getFinancialKpis 403 verir', async () => {
		const customer = await createCustomer(db, admin, {
			name: 'Mert Aydın',
			company: 'Aydın Bilişim',
			kind: 'active'
		});

		const now = new Date();
		const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

		// 1. Açık (sent) teklifli aktif ve gecikmiş iş (staff'a atanmış)
		const overdueItem = await createWorkItem(db, admin, {
			customerId: customer.id,
			assignedTo: staff.id,
			workType: 'service',
			title: 'Anakart tamiri',
			priority: 'high',
			dueDate: yesterday
		});
		const openQuote = await createQuote(db, admin, {
			workItemId: overdueItem.id,
			items: [
				{
					kind: 'labor',
					description: 'Anakart onarımı',
					qty: 1,
					unitPriceKurus: 2000_00,
					vatRate: 20
				}
			]
		});
		await sendQuote(db, admin, openQuote.id); // total = 2400_00 kuruş

		// 2. Bu ay onaylanan teklifli aktif iş (otherStaff'a atanmış)
		const approvedItem = await createWorkItem(db, admin, {
			customerId: customer.id,
			assignedTo: otherStaff.id,
			workType: 'agency',
			title: 'Web tasarım',
			dueDate: nextWeek
		});
		const approvedQ = await createQuote(db, admin, {
			workItemId: approvedItem.id,
			items: [
				{ kind: 'service', description: 'Tasarım', qty: 1, unitPriceKurus: 5000_00, vatRate: 20 }
			]
		});
		await sendQuote(db, admin, approvedQ.id);
		await approveQuote(db, admin, approvedQ.id); // total = 6000_00 kuruş

		// 3. Teslim edilmiş (geçmiş terminli olsa da aktif veya gecikmiş sayılmamalı)
		const deliveredItem = await createWorkItem(db, admin, {
			customerId: customer.id,
			assignedTo: staff.id,
			workType: 'service',
			title: 'SSD değişimi',
			dueDate: yesterday
		});
		await transitionWorkItemStatus(db, admin, deliveredItem.id, 'approved');
		await transitionWorkItemStatus(db, admin, deliveredItem.id, 'in_progress');
		await transitionWorkItemStatus(db, admin, deliveredItem.id, 'ready');
		await transitionWorkItemStatus(db, admin, deliveredItem.id, 'delivered');

		// Son 10 log limitini doğrulamak için 8 ek not daha ekleyelim
		for (let i = 1; i <= 8; i++) {
			await addWorkLog(db, admin, approvedItem.id, {
				message: `Ajans notu #${i}`,
				isPublic: false
			});
		}

		// Admin KPI doğrulaması
		const adminDash = await getDashboardSummary(db, admin, now);
		expect(adminDash.activeWorkCount).toBe(2);
		expect(adminDash.overdueWorkCount).toBe(1);
		expect(adminDash.financial).not.toBeNull();
		expect(adminDash.financial?.openQuoteTotalKurus).toBe(2400_00);
		expect(adminDash.financial?.monthlyApprovedTotalKurus).toBe(6000_00);
		expect(adminDash.recentLogs).toHaveLength(10);

		// Staff doğrudan finansal KPI fonksiyonunu çağıramaz (403)
		await expect(getFinancialKpis(db, staff, now)).rejects.toMatchObject({
			name: AuthError.name,
			status: 403
		});

		// Staff panoda finansal KPI göremez, yalnız kendisine atanan işlerin sayısını ve loglarını görür
		const staffDash = await getDashboardSummary(db, staff, now);
		expect(staffDash.financial).toBeNull();
		expect(staffDash.activeWorkCount).toBe(1);
		expect(staffDash.overdueWorkCount).toBe(1);
		expect(staffDash.recentLogs.every((l) => l.workItemId !== approvedItem.id)).toBe(true);
	});

	it('listWorkItems URL filtrelerini (q, status, workType, priority, overdue, assignedTo) uygular ve staff sınırını korur', async () => {
		const c1 = await createCustomer(db, admin, { name: 'Zeynep Karaca', kind: 'active' });
		const c2 = await createCustomer(db, admin, { name: 'Bora Şahin', kind: 'lead' });

		const now = new Date();
		const past = new Date(now.getTime() - 48 * 60 * 60 * 1000);

		const w1 = await createWorkItem(db, admin, {
			customerId: c1.id,
			assignedTo: staff.id,
			workType: 'service',
			title: 'Yazıcı kafa temizliği',
			priority: 'high',
			dueDate: past
		});
		const w2 = await createWorkItem(db, admin, {
			customerId: c2.id,
			assignedTo: otherStaff.id,
			workType: 'agency',
			title: 'Sosyal medya kampanyası',
			priority: 'low'
		});
		await transitionWorkItemStatus(db, admin, w2.id, 'quoted');

		expect((await listWorkItems(db, admin, { workType: 'service' })).map((x) => x.id)).toEqual([
			w1.id
		]);
		expect((await listWorkItems(db, admin, { status: 'quoted' })).map((x) => x.id)).toEqual([
			w2.id
		]);
		expect((await listWorkItems(db, admin, { priority: 'high' })).map((x) => x.id)).toEqual([
			w1.id
		]);
		expect((await listWorkItems(db, admin, { overdue: true }, now)).map((x) => x.id)).toEqual([
			w1.id
		]);
		expect((await listWorkItems(db, admin, { q: 'zeynep' })).map((x) => x.id)).toEqual([w1.id]);
		expect(
			(await listWorkItems(db, admin, { assignedTo: otherStaff.id })).map((x) => x.id)
		).toEqual([w2.id]);

		// Staff başka kullanıcının assignedTo filtresini verse bile başkasının işini göremez
		const staffAttempt = await listWorkItems(db, staff, { assignedTo: otherStaff.id });
		expect(staffAttempt).toEqual([]);
	});
});
