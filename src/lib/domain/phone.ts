export function normalizeTrPhone(raw: string | null | undefined): string | null {
	if (!raw) return null;

	const digits = raw.replace(/\D/g, '');
	let national: string;

	if (digits.length === 10 && digits.startsWith('5')) {
		national = digits;
	} else if (digits.length === 11 && digits.startsWith('05')) {
		national = digits.slice(1);
	} else if (digits.length === 12 && digits.startsWith('905')) {
		national = digits.slice(2);
	} else if (digits.length === 14 && digits.startsWith('00905')) {
		national = digits.slice(4);
	} else if (digits.length === 10 && /^[2348]\d{9}$/.test(digits)) {
		national = digits;
	} else if (digits.length === 11 && /^0[2348]\d{9}$/.test(digits)) {
		national = digits.slice(1);
	} else if (digits.length === 12 && /^90[2348]\d{9}$/.test(digits)) {
		national = digits.slice(2);
	} else if (digits.length === 14 && /^0090[2348]\d{9}$/.test(digits)) {
		national = digits.slice(4);
	} else {
		return null;
	}

	return `+90${national}`;
}

export function formatTrPhone(raw: string): string {
	const normalized = normalizeTrPhone(raw);
	if (!normalized) return raw;
	const n = normalized.slice(3); // 10 hane
	return `+90 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 8)} ${n.slice(8, 10)}`;
}

export function buildWhatsAppUrl(
	phone: string | null | undefined,
	message?: string
): string | null {
	const normalized = normalizeTrPhone(phone);
	if (!normalized) return null;
	const waDigits = normalized.slice(1); // 90XXXXXXXXXX
	if (!message || message.trim().length === 0) {
		return `https://wa.me/${waDigits}`;
	}
	return `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`;
}
