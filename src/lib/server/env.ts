const DEFAULT_DEV_DB_URL = 'postgres://minicrm:minicrm@localhost:5436/minicrm';
const DEFAULT_DEV_COOKIE_SECRET = 'dev-only-change-me-at-least-32-bytes-long';
const DEFAULT_DEV_DEMO_RESET_SECRET = 'dev-only-demo-reset-secret-change-me';

export function getDatabaseUrl(): string {
	const url = process.env.DATABASE_URL;
	if (url && url.trim().length > 0) {
		return url;
	}
	if (process.env.NODE_ENV === 'production') {
		throw new Error('DATABASE_URL ortam değişkeni üretimde zorunludur');
	}
	return DEFAULT_DEV_DB_URL;
}

export function getAuthCookieSecret(): string {
	const secret = process.env.AUTH_COOKIE_SECRET;
	if (secret && secret.length >= 16) {
		return secret;
	}
	if (process.env.NODE_ENV === 'production') {
		throw new Error('AUTH_COOKIE_SECRET ortam değişkeni üretimde en az 16 karakter olmalıdır');
	}
	return DEFAULT_DEV_COOKIE_SECRET;
}

export function getDemoResetSecret(): string | null {
	const secret = process.env.DEMO_RESET_SECRET;
	if (secret && secret.trim().length >= 16) {
		return secret.trim();
	}
	if (process.env.NODE_ENV === 'production') {
		return null;
	}
	return DEFAULT_DEV_DEMO_RESET_SECRET;
}
