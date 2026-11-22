import { describe, expect, it } from 'vitest';
import { calculateLineItem, calculateQuoteTotals, formatKurus, tlToKurus } from '$lib/domain/money';

describe('money domain (kuruş & KDV)', () => {
	it('KDV hariç kalem hesabını kuruş olarak doğru yapar', () => {
		const line = calculateLineItem({
			qty: 2,
			unitPriceKurus: 150_00,
			vatRate: 20,
			vatIncluded: false
		});

		expect(line).toEqual({
			lineSubtotalKurus: 300_00,
			lineVatKurus: 60_00,
			lineTotalKurus: 360_00
		});
	});

	it('KDV dahil kalem hesabında yuvarlama kayması olmadan ara toplam + KDV = toplam verir', () => {
		// 100,00 TL KDV dahil (%20): net = 83,33 TL (8333 kuruş), KDV = 16,67 TL (1667 kuruş)
		const line = calculateLineItem({
			qty: 1,
			unitPriceKurus: 100_00,
			vatRate: 20,
			vatIncluded: true
		});

		expect(line.lineTotalKurus).toBe(100_00);
		expect(line.lineSubtotalKurus).toBe(83_33);
		expect(line.lineVatKurus).toBe(16_67);
		expect(line.lineSubtotalKurus + line.lineVatKurus).toBe(line.lineTotalKurus);
	});

	it('kesirli miktar (ör. 1.5 saat işçilik) ve %0/%10/%20 karma KDV oranlarıyla teklif toplamını hesaplar', () => {
		const totals = calculateQuoteTotals(
			[
				{ qty: 1.5, unitPriceKurus: 400_00, vatRate: 20 }, // 600 TL + 120 TL = 720 TL
				{ qty: 1, unitPriceKurus: 250_00, vatRate: 10 }, // 250 TL + 25 TL = 275 TL
				{ qty: 2, unitPriceKurus: 50_00, vatRate: 0 } // 100 TL + 0 TL = 100 TL
			],
			false
		);

		expect(totals.subtotalKurus).toBe(950_00);
		expect(totals.vatTotalKurus).toBe(145_00);
		expect(totals.totalKurus).toBe(1095_00);
		expect(totals.lines).toHaveLength(3);
	});

	it('varsayılan KDV modu hariç (vatIncluded = false) olarak çalışır', () => {
		const totals = calculateQuoteTotals([{ qty: 1, unitPriceKurus: 100_00, vatRate: 20 }]);
		expect(totals.subtotalKurus).toBe(100_00);
		expect(totals.vatTotalKurus).toBe(20_00);
		expect(totals.totalKurus).toBe(120_00);
	});

	it('negatif birim fiyat, sıfır/negatif miktar veya geçersiz KDV oranında hata fırlatır', () => {
		expect(() =>
			calculateLineItem({ qty: 0, unitPriceKurus: 100_00, vatRate: 20, vatIncluded: false })
		).toThrow();
		expect(() =>
			calculateLineItem({ qty: 1, unitPriceKurus: -1, vatRate: 20, vatIncluded: false })
		).toThrow();
		expect(() =>
			calculateLineItem({ qty: 1, unitPriceKurus: 100_00, vatRate: 105, vatIncluded: false })
		).toThrow();
		expect(() =>
			calculateLineItem({ qty: 1, unitPriceKurus: 100.5, vatRate: 20, vatIncluded: false })
		).toThrow();
	});

	it('TL metin/sayı girdisini tam kuruşa çevirir ve tr-TR biçimlendirir', () => {
		expect(tlToKurus('1.250,50')).toBe(1250_50);
		expect(tlToKurus('1250.5')).toBe(1250_50);
		expect(tlToKurus(99.99)).toBe(99_99);
		expect(tlToKurus('0')).toBe(0);
		expect(() => tlToKurus('-5')).toThrow();
		expect(() => tlToKurus('abc')).toThrow();

		const formatted = formatKurus(1250_50);
		expect(formatted).toContain('1.250,50');
	});
});
