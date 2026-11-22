export const COMMON_VAT_RATES = [0, 10, 20] as const;

export interface LineItemInput {
	qty: number;
	unitPriceKurus: number;
	vatRate: number;
	vatIncluded?: boolean;
}

export interface CalculatedLineItem {
	lineSubtotalKurus: number;
	lineVatKurus: number;
	lineTotalKurus: number;
}

export interface QuoteTotalsResult {
	lines: CalculatedLineItem[];
	subtotalKurus: number;
	vatTotalKurus: number;
	totalKurus: number;
}

export function calculateLineItem(input: LineItemInput): CalculatedLineItem {
	const { qty, unitPriceKurus, vatRate, vatIncluded = false } = input;

	if (!Number.isFinite(qty) || qty <= 0) {
		throw new RangeError('Miktar sıfırdan büyük olmalıdır');
	}
	if (!Number.isInteger(unitPriceKurus) || unitPriceKurus < 0) {
		throw new RangeError('Birim fiyat negatif olmayan tam kuruş olmalıdır');
	}
	if (!Number.isInteger(vatRate) || vatRate < 0 || vatRate > 100) {
		throw new RangeError('KDV oranı 0 ile 100 arasında tam sayı olmalıdır');
	}

	if (vatIncluded) {
		const lineTotalKurus = Math.round(qty * unitPriceKurus);
		const lineSubtotalKurus =
			vatRate === 0 ? lineTotalKurus : Math.round((lineTotalKurus * 100) / (100 + vatRate));
		const lineVatKurus = lineTotalKurus - lineSubtotalKurus;
		return { lineSubtotalKurus, lineVatKurus, lineTotalKurus };
	}

	const lineSubtotalKurus = Math.round(qty * unitPriceKurus);
	const lineVatKurus = Math.round((lineSubtotalKurus * vatRate) / 100);
	const lineTotalKurus = lineSubtotalKurus + lineVatKurus;
	return { lineSubtotalKurus, lineVatKurus, lineTotalKurus };
}

export function calculateQuoteTotals(
	items: Array<{ qty: number; unitPriceKurus: number; vatRate: number }>,
	vatIncluded = false
): QuoteTotalsResult {
	const lines = items.map((item) => calculateLineItem({ ...item, vatIncluded }));

	let subtotalKurus = 0;
	let vatTotalKurus = 0;
	let totalKurus = 0;

	for (const line of lines) {
		subtotalKurus += line.lineSubtotalKurus;
		vatTotalKurus += line.lineVatKurus;
		totalKurus += line.lineTotalKurus;
	}

	return { lines, subtotalKurus, vatTotalKurus, totalKurus };
}

const trCurrencyFormatter = new Intl.NumberFormat('tr-TR', {
	style: 'currency',
	currency: 'TRY',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

export function formatKurus(kurus: number): string {
	if (!Number.isFinite(kurus)) {
		throw new RangeError('Geçersiz kuruş tutarı');
	}
	return trCurrencyFormatter.format(kurus / 100);
}

export function tlToKurus(input: string | number): number {
	if (typeof input === 'number') {
		if (!Number.isFinite(input) || input < 0) {
			throw new RangeError('Tutar negatif olamaz');
		}
		return Math.round(input * 100);
	}

	const trimmed = input.trim();
	if (trimmed.length === 0) {
		throw new RangeError('Tutar boş olamaz');
	}

	// TR formatı (1.250,50) veya noktalı format (1250.50) desteği
	let normalized = trimmed.replace(/\s+/g, '');
	if (normalized.includes(',')) {
		normalized = normalized.replace(/\./g, '').replace(',', '.');
	}

	if (!/^\d+(\.\d+)?$/.test(normalized)) {
		throw new RangeError('Geçersiz tutar biçimi');
	}

	const value = Number(normalized);
	if (!Number.isFinite(value) || value < 0) {
		throw new RangeError('Geçersiz tutar');
	}

	return Math.round(value * 100);
}
