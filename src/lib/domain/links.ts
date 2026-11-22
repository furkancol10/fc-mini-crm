const SIMPLE_EMAIL_RE =
	/^[^\s@<>()[\]\\,;:"\r\n]+@[^\s@<>()[\]\\,;:"\r\n]+\.[^\s@<>()[\]\\,;:"\r\n]+$/;

export function buildMailtoUrl(
	email: string | null | undefined,
	subject?: string,
	body?: string
): string | null {
	if (!email) return null;
	const trimmed = email.trim();
	if (trimmed.length === 0 || /[\r\n]/.test(trimmed) || !SIMPLE_EMAIL_RE.test(trimmed)) {
		return null;
	}

	const params: string[] = [];
	if (subject && subject.trim().length > 0) {
		params.push(`subject=${encodeURIComponent(subject.trim())}`);
	}
	if (body && body.trim().length > 0) {
		params.push(`body=${encodeURIComponent(body.trim())}`);
	}

	return params.length > 0 ? `mailto:${trimmed}?${params.join('&')}` : `mailto:${trimmed}`;
}

export function buildTrackingShareMessage(input: {
	code: string;
	title: string;
	statusLabel: string;
	trackingUrl: string;
}): string {
	return `Merhaba, ${input.code} (${input.title}) kaydınızın güncel durumu: ${input.statusLabel}. Teklif ve süreç takibi için bağlantınız: ${input.trackingUrl}`;
}
