import { readFile } from 'node:fs/promises';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const DEMO_RESET_SECRET = process.env.DEMO_RESET_SECRET ?? 'dev-only-demo-reset-secret-change-me';

async function resetDemoViaApi(request: APIRequestContext) {
	const res = await request.post('/api/demo-reset', {
		headers: { 'x-demo-reset-secret': DEMO_RESET_SECRET },
		data: {}
	});
	expect(res.status(), await res.text()).toBe(200);
}

async function loginAs(page: Page, roleLabel: 'Yönetici' | 'Teknisyen') {
	await page.goto('/giris');
	await expect(page).toHaveTitle(/Giriş — Mini CRM/);
	await page.locator('main button', { hasText: roleLabel }).click();
	await expect(page).toHaveURL(/\/pano$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Pano' })).toBeVisible();
}

async function assertNoHorizontalOverflow(page: Page) {
	const metrics = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: document.documentElement.clientWidth
	}));
	expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
}

test.describe('Mini CRM uçtan uca akışlar (gerçek PostgreSQL)', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoViaApi(request);
	});

	test('ana akış: Yönetici girişi → müşteri → servis işi → kalemli KDV teklif → gönder → takip onayı → kısmi ve tam ödeme → bakiye 0 → teslim', async ({
		page,
		browser
	}) => {
		await loginAs(page, 'Yönetici');

		// 1. Müşteri ekle
		await page
			.getByRole('navigation', { name: 'Ana gezinme' })
			.getByRole('link', { name: 'Müşteriler' })
			.click();
		await expect(page).toHaveURL(/\/musteriler$/);
		await expect(page).toHaveTitle(/Müşteriler — Mini CRM/);

		await page.locator('input[name="name"]').fill('E2E Test Müşteri');
		await page.locator('input[name="company"]').fill('Test Elektronik Ltd.');
		await page.locator('input[name="phone"]').fill('0532 111 22 33');
		await page.locator('input[name="email"]').fill('e2e@testelektronik.test');
		await page.locator('select[name="kind"]').selectOption('active');
		await page.getByRole('button', { name: 'Müşteri Kaydet' }).click();

		await expect(page.getByRole('status')).toContainText('Müşteri kaydedildi.');
		await expect(page.getByRole('link', { name: 'E2E Test Müşteri' }).first()).toBeVisible();

		// 2. Servis işi oluştur
		await page
			.getByRole('navigation', { name: 'Ana gezinme' })
			.getByRole('link', { name: 'İşler' })
			.click();
		await expect(page).toHaveURL(/\/isler$/);
		await expect(page).toHaveTitle(/İş Kayıtları — Mini CRM/);

		await page.locator('summary', { hasText: '+ Yeni İş / Talep Oluştur' }).click();
		const createWorkForm = page.locator('form[action="?/create"]');
		await expect(createWorkForm).toBeVisible();

		await createWorkForm
			.locator('select[name="customerId"]')
			.selectOption({ label: 'E2E Test Müşteri (Test Elektronik Ltd.)' });
		await createWorkForm.locator('select[name="workType"]').selectOption('service');
		await createWorkForm.locator('input[name="title"]').fill('E2E Anakart ve SSD Değişimi');
		await createWorkForm.locator('input[name="meta_device"]').fill('Dizüstü Bilgisayar');
		await createWorkForm.locator('input[name="meta_brand"]').fill('Lenovo');
		await createWorkForm.locator('input[name="meta_model"]').fill('ThinkPad X1');
		await createWorkForm.locator('input[name="meta_serialNo"]').fill('SN-E2E-001');
		await createWorkForm
			.locator('textarea[name="description"]')
			.fill('Cihaz açılmıyor, disk ve anakart kontrol edilecek.');
		await createWorkForm.getByRole('button', { name: 'İş Kaydı Oluştur' }).click();

		await expect(page).toHaveURL(/\/isler\/\d+$/);
		const workDetailUrl = page.url();
		await expect(page.getByRole('heading', { level: 1 })).toContainText(
			'E2E Anakart ve SSD Değişimi'
		);
		await expect(page.locator('dt', { hasText: 'Seri No' })).toBeVisible();

		// 3. İki kalemli, %20 KDV hariç teklif oluştur (2000 + 2*500 = 3000 ara toplam, 600 KDV, 3600 genel toplam)
		const quoteForm = page.locator('form[action="?/createQuote"]');
		await quoteForm.locator('select[name="vatIncluded"]').selectOption('false');

		await quoteForm.locator('select[name="item_kind"]').nth(0).selectOption('part');
		await quoteForm.locator('input[name="item_description"]').nth(0).fill('1 TB NVMe SSD');
		await quoteForm.locator('input[name="item_qty"]').nth(0).fill('1');
		await quoteForm.locator('input[name="item_unitPriceTl"]').nth(0).fill('2000,00');
		await quoteForm.locator('select[name="item_vatRate"]').nth(0).selectOption('20');

		await quoteForm.getByRole('button', { name: '+ Kalem Ekle' }).click();

		await quoteForm.locator('select[name="item_kind"]').nth(1).selectOption('labor');
		await quoteForm.locator('input[name="item_description"]').nth(1).fill('Montaj ve Kurulum');
		await quoteForm.locator('input[name="item_qty"]').nth(1).fill('2');
		await quoteForm.locator('input[name="item_unitPriceTl"]').nth(1).fill('500,00');
		await quoteForm.locator('select[name="item_vatRate"]').nth(1).selectOption('20');

		await quoteForm.getByRole('button', { name: 'Taslak Teklif Kaydet' }).click();

		await expect(page.getByRole('status')).toContainText('Taslak teklif oluşturuldu.');
		const quotesSection = page.locator('section', {
			has: page.getByRole('heading', { name: 'Teklifler' })
		});
		await expect(quotesSection).toContainText('3.000,00');
		await expect(quotesSection).toContainText('600,00');
		await expect(quotesSection).toContainText('3.600,00');

		// 4. Teklifi gönder
		await page.locator('form[action="?/sendQuote"] button[type="submit"]').click();
		await expect(page.getByRole('status')).toContainText('Teklif gönderildi.');
		await expect(page.getByText('Teklif Verildi').first()).toBeVisible();

		// 5. /takip/[token] üzerinden oturumsuz müşteri olarak onayla
		const trackingHref = await page
			.getByRole('link', { name: 'Takip Sayfası' })
			.getAttribute('href');
		expect(trackingHref).toMatch(/^\/takip\/.+/);

		const customerContext = await browser.newContext({
			viewport: page.viewportSize() ?? undefined,
			locale: 'tr-TR'
		});
		const customerPage = await customerContext.newPage();
		try {
			await customerPage.goto(trackingHref!);
			await expect(customerPage.getByRole('heading', { level: 1 })).toContainText(
				'E2E Anakart ve SSD Değişimi'
			);
			const customerQuotesSection = customerPage.locator('section', {
				has: customerPage.getByRole('heading', { name: 'Teklifler' })
			});
			await expect(customerQuotesSection).toContainText('3.600,00');

			// PII sızmamalı
			const publicBody = await customerPage.locator('body').innerText();
			expect(publicBody).not.toContain('e2e@testelektronik.test');
			expect(publicBody).not.toContain('111 22 33');
			expect(publicBody).not.toContain('E2E Test Müşteri');

			await customerPage.getByRole('button', { name: 'Teklifi Onayla' }).click();
			await expect(customerPage.getByRole('status')).toContainText('Teklifiniz onaylandı');
			await expect(customerPage.getByRole('button', { name: 'Teklifi Onayla' })).toHaveCount(0);
		} finally {
			await customerContext.close();
		}

		// 6. Yönetici ekranında onaylı durum + kısmi ödeme + tam ödeme (bakiye 0)
		await page.goto(workDetailUrl);
		const balanceSection = page.locator('section', { hasText: 'Tahsilat ve Bakiye' });
		await expect(balanceSection).toContainText('Ödenmedi');
		await expect(balanceSection).toContainText('3.600,00');

		// Kısmi ödeme: 1.500,00 TL
		const paymentForm = page.locator('form[action="?/addPayment"]');
		await paymentForm.locator('input[name="amountTl"]').fill('1500,00');
		await paymentForm.locator('select[name="method"]').selectOption('transfer');
		await paymentForm.locator('input[name="invoiceRef"]').fill('AVN-E2E-1');
		await paymentForm.getByRole('button', { name: 'Tahsilat Ekle' }).click();

		await expect(page.getByRole('status')).toContainText('Tahsilat kaydedildi.');
		await expect(balanceSection).toContainText('Kısmi Ödendi');
		await expect(balanceSection).toContainText('1.500,00');
		await expect(balanceSection).toContainText('2.100,00');

		// Tam ödeme (kalan): 2.100,00 TL → bakiye 0
		await paymentForm.locator('input[name="amountTl"]').fill('2100,00');
		await paymentForm.locator('select[name="method"]').selectOption('card');
		await paymentForm.locator('input[name="invoiceRef"]').fill('FTR-E2E-2');
		await paymentForm.getByRole('button', { name: 'Tahsilat Ekle' }).click();

		await expect(balanceSection).toContainText('Ödendi');
		await expect(balanceSection.locator('div', { hasText: 'Kalan Bakiye' }).first()).toContainText(
			'0,00'
		);

		// 7. Durum geçişleri: Onaylandı → Onarımda → Teslime Hazır → Teslim Edildi
		const transitionForm = page.locator('form[action="?/transition"]');
		await transitionForm.locator('select[name="nextStatus"]').selectOption('in_progress');
		await transitionForm.getByRole('button', { name: 'Durumu Güncelle' }).click();
		await expect(page.getByText('Onarımda').first()).toBeVisible();

		await transitionForm.locator('select[name="nextStatus"]').selectOption('ready');
		await transitionForm.getByRole('button', { name: 'Durumu Güncelle' }).click();
		await expect(page.getByText('Teslime Hazır').first()).toBeVisible();

		await transitionForm.locator('select[name="nextStatus"]').selectOption('delivered');
		await transitionForm.getByRole('button', { name: 'Durumu Güncelle' }).click();
		await expect(page.getByText('Teslim Edildi').first()).toBeVisible();
		await expect(
			page.getByText('Bu iş son durumda olduğu için yeni geçiş yapılamaz.')
		).toBeVisible();
	});

	test('teknisyen rolünde tutar KPI ve CSV gizli, /api/export 403 döner', async ({ page }) => {
		await loginAs(page, 'Teknisyen');

		// Tutar KPI'ları ve yönetici araçları görünmez
		await expect(page.getByText('Aktif İş')).toBeVisible();
		await expect(page.getByText('Geciken İş')).toBeVisible();
		await expect(page.getByText('Açık Teklif Tutarı')).toHaveCount(0);
		await expect(page.getByText('Aylık Onaylanan')).toHaveCount(0);
		await expect(page.getByText('CSV Dışa Aktarım')).toHaveCount(0);
		await expect(page.getByText('Demo Verisini Sıfırla')).toHaveCount(0);

		// İşler sayfasında CSV gizli ve yalnız teknisyene atanan işler görünür
		await page
			.getByRole('navigation', { name: 'Ana gezinme' })
			.getByRole('link', { name: 'İşler' })
			.click();
		await expect(page).toHaveURL(/\/isler$/);
		await expect(page.getByText('(yalnız size atananlar)')).toBeVisible();
		await expect(page.getByRole('link', { name: 'CSV İndir' })).toHaveCount(0);
		await expect(page.getByRole('link', { name: /TS-DM0001/ }).first()).toBeVisible();
		await expect(page.getByRole('link', { name: /AJ-DM0001/ })).toHaveCount(0);

		// Doğrudan CSV API çağrısı 403 verir
		const exportRes = await page.request.get('/api/export?type=work_items');
		expect(exportRes.status()).toBe(403);
	});

	test('yönetici CSV indirir (UTF-8 BOM ve ; ayırıcı doğrulanır)', async ({ page }) => {
		await loginAs(page, 'Yönetici');

		const [download] = await Promise.all([
			page.waitForEvent('download'),
			page.getByRole('link', { name: 'İşler CSV' }).click()
		]);

		expect(download.suggestedFilename()).toMatch(/^isler-\d{4}-\d{2}-\d{2}\.csv$/);
		const filePath = await download.path();
		expect(filePath).toBeTruthy();

		const buf = await readFile(filePath!);
		// UTF-8 BOM: EF BB BF
		expect(Array.from(buf.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);

		const text = buf.subarray(3).toString('utf8');
		expect(text).toContain('Kod;Başlık;Sektör;Durum');
		expect(text).toContain('TS-DM0001');
	});

	test('demo sıfırlama sonrası geçici veri silinir ve başlangıç verisi geri gelir', async ({
		page
	}) => {
		await loginAs(page, 'Yönetici');

		// Geçici müşteri ekle
		await page
			.getByRole('navigation', { name: 'Ana gezinme' })
			.getByRole('link', { name: 'Müşteriler' })
			.click();
		await page.locator('input[name="name"]').fill('Silinecek Geçici Müşteri');
		await page.getByRole('button', { name: 'Müşteri Kaydet' }).click();
		await expect(page.getByText('Toplam 9 kayıt')).toBeVisible();
		await expect(
			page.getByRole('link', { name: 'Silinecek Geçici Müşteri' }).first()
		).toBeVisible();

		// Panodan demo sıfırla
		await page
			.getByRole('navigation', { name: 'Ana gezinme' })
			.getByRole('link', { name: 'Pano' })
			.click();
		await page.getByRole('button', { name: 'Demo verisini sıfırla' }).click();
		await expect(page.getByRole('status')).toContainText(
			'Demo verisi sıfırlandı (8 müşteri, 14 iş kaydı).'
		);

		// Başlangıç verisinin döndüğünü doğrula
		await page
			.getByRole('navigation', { name: 'Ana gezinme' })
			.getByRole('link', { name: 'Müşteriler' })
			.click();
		await expect(page.getByText('Toplam 8 kayıt')).toBeVisible();
		await expect(page.getByText('Silinecek Geçici Müşteri')).toHaveCount(0);
		await expect(page.getByRole('link', { name: 'Selim Karahan' }).first()).toBeVisible();

		await page
			.getByRole('navigation', { name: 'Ana gezinme' })
			.getByRole('link', { name: 'İşler' })
			.click();
		await expect(page.getByText('14 kayıt')).toBeVisible();
		await expect(page.getByRole('link', { name: /TS-DM0001/ }).first()).toBeVisible();
	});

	test('ana ekranlarda yatay taşma yok ve sayfa başlıkları Türkçe', async ({ page }) => {
		await page.goto('/giris');
		await expect(page).toHaveTitle(/Giriş — Mini CRM/);
		await assertNoHorizontalOverflow(page);

		await loginAs(page, 'Yönetici');
		await assertNoHorizontalOverflow(page);

		await page.goto('/isler');
		await expect(page).toHaveTitle(/İş Kayıtları — Mini CRM/);
		await assertNoHorizontalOverflow(page);

		await page.goto('/isler?view=kanban');
		await assertNoHorizontalOverflow(page);

		await page.goto('/musteriler');
		await expect(page).toHaveTitle(/Müşteriler — Mini CRM/);
		await assertNoHorizontalOverflow(page);

		// İlk iş detayı (TS-DM0002 revize teklifli iş) + teklif yazdır + takip sayfası
		await page.goto('/isler');
		await page
			.getByRole('link', { name: /TS-DM0002/ })
			.first()
			.click();
		await expect(page).toHaveURL(/\/isler\/\d+$/);
		await expect(page).toHaveTitle(/TS-DM0002.*Mini CRM/);
		await assertNoHorizontalOverflow(page);

		const printHref = await page.getByRole('link', { name: 'Yazdır' }).first().getAttribute('href');
		expect(printHref).toMatch(/^\/teklif\/\d+\/yazdir$/);
		const trackingHref = await page
			.getByRole('link', { name: 'Takip Sayfası' })
			.getAttribute('href');
		expect(trackingHref).toMatch(/^\/takip\/.+/);

		await page.goto(printHref!);
		await expect(page).toHaveTitle(/Teklif .*Mini CRM/);
		await assertNoHorizontalOverflow(page);

		await page.goto(trackingHref!);
		await expect(page).toHaveTitle(/İş Takibi — TS-DM0002 \| Mini CRM/);
		await assertNoHorizontalOverflow(page);
	});
});
