import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AuthUser } from '$lib/server/auth/types';
import { createCustomer } from '$lib/server/crm/customers';
import { ConflictError, NotFoundError, ValidationError } from '$lib/server/crm/errors';
import {
	QuoteApprovalConflictError,
	approveQuote,
	createQuote,
	sendQuote
} from '$lib/server/crm/quotes';
import {
	approveQuoteByToken,
	getPublicWorkItemByToken,
	rejectQuoteByToken
} from '$lib/server/crm/tracking';
import { addWorkLog, createWorkItem } from '$lib/server/crm/work';
import type { Database } from '$lib/server/db/client';
import { quotes, workItems, workLogs } from '$lib/server/db/schema';
import { closeDb } from '$lib/server/db/client';
import { resetAllRateLimiters } from '$lib/server/rate-limit';
import {
	actions as takipActions,
	load as takipLoad
} from '../../src/routes/takip/[token]/+page.server';
import { openTestDb, resetTestDb, seedTestUsers, TEST_DB_URL } from './helpers';

describe('müşteri takip sayfası /takip/[token] (gerçek Postgres)', () => {
	let db: Database;
	let client: Awaited<ReturnType<typeof openTestDb>>['client'];
	let admin: AuthUser;
	const prevDbUrl = process.env.DATABASE_URL;

	beforeAll(async () => {
		process.env.DATABASE_URL = TEST_DB_URL;
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
	});

	afterAll(async () => {
		await closeDb();
		await client.end();
		if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
		else process.env.DATABASE_URL = prevDbUrl;
	});

	it('yanlış veya olmayan token 404 (NotFoundError) döner', async () => {
		await expect(getPublicWorkItemByToken(db, 'olmayan-rastgele-token')).rejects.toBeInstanceOf(
			NotFoundError
		);
		await expect(getPublicWorkItemByToken(db, '')).rejects.toBeInstanceOf(NotFoundError);
	});

	it('PII (telefon, e-posta, vergi no, müşteri notu), iç log (is_public=false) ve taslak teklif sızmaz', async () => {
		const customer = await createCustomer(db, admin, {
			name: 'Gizli Müşteri Adı',
			company: 'Gizli Firma AŞ',
			phone: '0532 987 65 43',
			email: 'gizli.eposta@ornek.test',
			taxNo: '1234567890',
			notes: 'SADECE_IC_MUSTERI_NOTU',
			kind: 'active'
		});

		const item = await createWorkItem(db, admin, {
			customerId: customer.id,
			workType: 'service',
			title: 'Dizüstü ekran değişimi',
			description: 'IC_ACIKLAMA_SIZMAMALI'
		});

		await addWorkLog(db, admin, item.id, {
			message: 'SADECE_IC_LOG_GIZLI',
			isPublic: false
		});
		await addWorkLog(db, admin, item.id, {
			message: 'Parça testi tamamlandı, teklif hazırlandı.',
			isPublic: true
		});

		// Taslak teklif müşteriye görünmemeli
		await createQuote(db, admin, {
			workItemId: item.id,
			notes: 'TASLAK_GIZLI_NOT',
			items: [
				{
					kind: 'part',
					description: 'TASLAK_KALEM_GIZLI',
					qty: 1,
					unitPriceKurus: 999_00,
					vatRate: 20
				}
			]
		});

		// Gönderilmiş teklif görünmeli
		const sentQuote = await createQuote(db, admin, {
			workItemId: item.id,
			notes: '7 gün geçerlidir',
			items: [
				{
					kind: 'part',
					description: '15.6 inç IPS Panel',
					qty: 1,
					unitPriceKurus: 3200_00,
					vatRate: 20
				}
			]
		});
		await sendQuote(db, admin, sentQuote.id);

		const publicView = await getPublicWorkItemByToken(db, item.publicToken);
		const serialized = JSON.stringify(publicView);

		// Görünmesi gerekenler
		expect(publicView.workItem.code).toBe(item.code);
		expect(publicView.workItem.title).toBe('Dizüstü ekran değişimi');
		expect(publicView.publicLogs.some((l) => l.message.includes('Parça testi tamamlandı'))).toBe(
			true
		);
		expect(publicView.quotes).toHaveLength(1);
		expect(publicView.quotes[0].quoteNo).toBe(sentQuote.quoteNo);

		// Sızmaması gereken PII ve iç veriler
		expect(serialized).not.toContain('9876543');
		expect(serialized).not.toContain('987 65 43');
		expect(serialized).not.toContain('gizli.eposta@ornek.test');
		expect(serialized).not.toContain('1234567890');
		expect(serialized).not.toContain('Gizli Müşteri Adı');
		expect(serialized).not.toContain('SADECE_IC_MUSTERI_NOTU');
		expect(serialized).not.toContain('SADECE_IC_LOG_GIZLI');
		expect(serialized).not.toContain('IC_ACIKLAMA_SIZMAMALI');
		expect(serialized).not.toContain('TASLAK_GIZLI_NOT');
		expect(serialized).not.toContain('TASLAK_KALEM_GIZLI');
	});

	it('müşteri teklifi onaylar/reddeder ve tek-approved kısmi tekil indeksi ile çakışmaz', async () => {
		const customer = await createCustomer(db, admin, { name: 'Ece Yılmaz', kind: 'active' });
		const item = await createWorkItem(db, admin, {
			customerId: customer.id,
			workType: 'agency',
			title: 'Landing page tasarımı'
		});

		const draftQ = await createQuote(db, admin, {
			workItemId: item.id,
			items: [
				{ kind: 'service', description: 'Taslak', qty: 1, unitPriceKurus: 1000_00, vatRate: 20 }
			]
		});
		const q1 = await createQuote(db, admin, {
			workItemId: item.id,
			items: [
				{ kind: 'service', description: 'Paket A', qty: 1, unitPriceKurus: 3000_00, vatRate: 20 }
			]
		});
		const q2 = await createQuote(db, admin, {
			workItemId: item.id,
			items: [
				{ kind: 'service', description: 'Paket B', qty: 1, unitPriceKurus: 4500_00, vatRate: 20 }
			]
		});
		await sendQuote(db, admin, q1.id);
		await sendQuote(db, admin, q2.id);

		// Taslak teklif müşteri tarafından onaylanamaz
		await expect(approveQuoteByToken(db, item.publicToken, draftQ.id)).rejects.toBeInstanceOf(
			ValidationError
		);

		// Paralel yarış: müşteri q1'i, yönetici q2'yi aynı anda onaylamaya çalışır -> tam 1 başarı
		const race = await Promise.allSettled([
			approveQuoteByToken(db, item.publicToken, q1.id),
			approveQuote(db, admin, q2.id)
		]);
		const ok = race.filter((r) => r.status === 'fulfilled');
		const fail = race.filter((r) => r.status === 'rejected');

		expect(ok).toHaveLength(1);
		expect(fail).toHaveLength(1);
		expect((fail[0] as PromiseRejectedResult).reason).toBeInstanceOf(QuoteApprovalConflictError);

		const approvedRows = await db
			.select()
			.from(quotes)
			.where(and(eq(quotes.workItemId, item.id), eq(quotes.status, 'approved')));
		expect(approvedRows).toHaveLength(1);

		const [updatedWork] = await db.select().from(workItems).where(eq(workItems.id, item.id));
		expect(updatedWork.status).toBe('approved');

		// Onaylanmış teklif müşteri tarafından reddedilemez (409)
		await expect(
			rejectQuoteByToken(db, item.publicToken, approvedRows[0].id)
		).rejects.toBeInstanceOf(ConflictError);

		// Ayrı işte müşteri reddetme akışı
		const item2 = await createWorkItem(db, admin, {
			customerId: customer.id,
			workType: 'service',
			title: 'Batarya değişimi'
		});
		const q3 = await createQuote(db, admin, {
			workItemId: item2.id,
			items: [
				{ kind: 'part', description: 'Batarya', qty: 1, unitPriceKurus: 1200_00, vatRate: 20 }
			]
		});
		await sendQuote(db, admin, q3.id);

		const rejected = await rejectQuoteByToken(db, item2.publicToken, q3.id);
		expect(rejected.status).toBe('rejected');

		const logs = await db.select().from(workLogs).where(eq(workLogs.workItemId, item2.id));
		expect(logs.some((l) => l.isPublic && l.message.includes('reddetti'))).toBe(true);
	});

	it('/takip/[token] rota katmanı yanlış tokenda 404, aşırı onay/red isteğinde 429 verir', async () => {
		await expect(
			takipLoad({
				params: { token: 'olmayan-token-404' },
				getClientAddress: () => '10.1.1.1'
			} as never)
		).rejects.toMatchObject({ status: 404 });

		const customer = await createCustomer(db, admin, { name: 'Tarık Yavuz', kind: 'active' });
		const item = await createWorkItem(db, admin, {
			customerId: customer.id,
			workType: 'service',
			title: 'Hız sınırı testi'
		});

		let hit429 = false;
		for (let i = 0; i < 12; i++) {
			const fd = new FormData();
			fd.set('quoteId', '999999');
			const res = await takipActions.rejectQuote({
				params: { token: item.publicToken },
				request: new Request('http://localhost/takip/' + item.publicToken, {
					method: 'POST',
					body: fd
				}),
				getClientAddress: () => '10.1.1.2'
			} as never);
			if (res && typeof res === 'object' && 'status' in res && res.status === 429) {
				hit429 = true;
				break;
			}
		}
		expect(hit429).toBe(true);
	});
});
