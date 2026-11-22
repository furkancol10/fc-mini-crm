import { describe, expect, it } from 'vitest';
import { buildMailtoUrl, buildTrackingShareMessage } from '$lib/domain/links';

describe('links domain (mailto ve takip paylaşım mesajı)', () => {
	it('geçerli e-posta için konu ve gövde kodlanmış mailto bağlantısı üretir', () => {
		const url = buildMailtoUrl(
			'musteri@ornek.test',
			'Teklifiniz Hazır — TS-001',
			'Takip bağlantısı: https://demo.test/takip/abc'
		);
		expect(url).toBe(
			'mailto:musteri@ornek.test?subject=Teklifiniz%20Haz%C4%B1r%20%E2%80%94%20TS-001&body=Takip%20ba%C4%9Flant%C4%B1s%C4%B1%3A%20https%3A%2F%2Fdemo.test%2Ftakip%2Fabc'
		);
	});

	it('konu/gövde olmadan yalın mailto üretir, geçersiz e-postada null döner', () => {
		expect(buildMailtoUrl('destek@firma.test')).toBe('mailto:destek@firma.test');
		expect(buildMailtoUrl('')).toBeNull();
		expect(buildMailtoUrl(null)).toBeNull();
		expect(buildMailtoUrl('gecersiz-eposta')).toBeNull();
		expect(buildMailtoUrl('a@b.test\r\nBcc:evil@x.test')).toBeNull();
	});

	it('takip paylaşım mesajında iş kodu, durum ve takip bağlantısı yer alır', () => {
		const msg = buildTrackingShareMessage({
			code: 'TS-DM0002',
			title: 'Ekran kartı arızası',
			statusLabel: 'Teklif Verildi',
			trackingUrl: 'https://demo.test/takip/tok123'
		});
		expect(msg).toContain('TS-DM0002');
		expect(msg).toContain('Teklif Verildi');
		expect(msg).toContain('https://demo.test/takip/tok123');
	});
});
