const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
	if (value === null || value === undefined) {
		return '';
	}

	let text = String(value);
	if (FORMULA_PREFIX_RE.test(text)) {
		text = `'${text}`;
	}

	if (text.includes(';') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
		return `"${text.replace(/"/g, '""')}"`;
	}

	return text;
}

export function toCsv(
	headers: string[],
	rows: Array<Array<string | number | boolean | null | undefined>>
): string {
	const lines = [
		headers.map(escapeCsvCell).join(';'),
		...rows.map((row) => row.map(escapeCsvCell).join(';'))
	];
	return `\uFEFF${lines.join('\r\n')}\r\n`;
}
