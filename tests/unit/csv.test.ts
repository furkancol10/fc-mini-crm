import { describe, expect, it } from 'vitest';
import { escapeCsvCell, toCsv } from '$lib/domain/csv';

describe('csv domain (BOM, ;, formül kaçışı)', () => {
	it('UTF-8 BOM ve noktalı virgül ayırıcı ile CSV üretir', () => {
		const output = toCsv(['Kod', 'Müşteri', 'Tutar'], [['TS-001', 'Ahmet Yılmaz', '1250,00']]);

		expect(output.startsWith('\uFEFF')).toBe(true);
		expect(output).toBe('\uFEFFKod;Müşteri;Tutar\r\nTS-001;Ahmet Yılmaz;1250,00\r\n');
	});

	it('Excel formül enjeksiyonu karakterlerini tek tırnak ile etkisizleştirir', () => {
		expect(escapeCsvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
		expect(escapeCsvCell('+1+1')).toBe("'+1+1");
		expect(escapeCsvCell('-2+3')).toBe("'-2+3");
		expect(escapeCsvCell('@HYPERLINK("x")')).toBe('"\'@HYPERLINK(""x"")"');
		expect(escapeCsvCell('\t=1+1')).toBe("'\t=1+1");
	});

	it('noktalı virgül, çift tırnak ve satır sonu içeren hücreleri doğru kaçırır', () => {
		expect(escapeCsvCell('A;B')).toBe('"A;B"');
		expect(escapeCsvCell('Ekran "15 inç"')).toBe('"Ekran ""15 inç"""');
		expect(escapeCsvCell('Satır 1\nSatır 2')).toBe('"Satır 1\nSatır 2"');
		expect(escapeCsvCell(null)).toBe('');
	});
});
