import { describe, expect, it } from 'vitest';
import { buildWhatsAppUrl, formatTrPhone, normalizeTrPhone } from '$lib/domain/phone';

describe('phone domain (TR +90 & wa.me)', () => {
	it('çeşitli TR telefon biçimlerini +90XXXXXXXXXX formatına normalize eder', () => {
		expect(normalizeTrPhone('0532 123 45 67')).toBe('+905321234567');
		expect(normalizeTrPhone('5321234567')).toBe('+905321234567');
		expect(normalizeTrPhone('+90 (532) 123-45-67')).toBe('+905321234567');
		expect(normalizeTrPhone('0090 532 123 45 67')).toBe('+905321234567');
		expect(normalizeTrPhone('905321234567')).toBe('+905321234567');
	});

	it('geçersiz numaralarda null döner', () => {
		expect(normalizeTrPhone('')).toBeNull();
		expect(normalizeTrPhone('12345')).toBeNull();
		expect(normalizeTrPhone('0532123456789')).toBeNull();
		expect(normalizeTrPhone('abc')).toBeNull();
	});

	it('wa.me bağlantısını kodlanmış mesajla oluşturur', () => {
		const url = buildWhatsAppUrl('0532 123 45 67', 'Merhaba, teklifiniz hazır.');
		expect(url).toBe('https://wa.me/905321234567?text=Merhaba%2C%20teklifiniz%20haz%C4%B1r.');
		expect(buildWhatsAppUrl('geçersiz', 'Merhaba')).toBeNull();
	});

	it('okunabilir TR telefon formatı üretir', () => {
		expect(formatTrPhone('5321234567')).toBe('+90 532 123 45 67');
		expect(formatTrPhone('geçersiz')).toBe('geçersiz');
	});
});
