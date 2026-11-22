import crypto from 'node:crypto';
import { getAuthCookieSecret } from '../env';

export const AUTH_COOKIE_NAME = 'crm_demo_auth';

export interface SessionCookiePayload {
	userId: number;
}

function hmacSign(data: string, secret: string): string {
	return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

export function signSessionCookie(
	payload: SessionCookiePayload,
	secret = getAuthCookieSecret()
): string {
	const body = Buffer.from(JSON.stringify({ userId: payload.userId }), 'utf8').toString(
		'base64url'
	);
	const signature = hmacSign(body, secret);
	return `${body}.${signature}`;
}

export function verifySessionCookie(
	token: string | undefined | null,
	secret = getAuthCookieSecret()
): SessionCookiePayload | null {
	if (!token) return null;
	const dotIndex = token.indexOf('.');
	if (dotIndex <= 0 || dotIndex !== token.lastIndexOf('.')) {
		return null;
	}

	const body = token.slice(0, dotIndex);
	const providedSig = token.slice(dotIndex + 1);
	if (!body || !providedSig) return null;

	const expectedSig = hmacSign(body, secret);
	const providedBuf = Buffer.from(providedSig, 'utf8');
	const expectedBuf = Buffer.from(expectedSig, 'utf8');
	if (providedBuf.length !== expectedBuf.length) {
		return null;
	}
	if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
		return null;
	}

	try {
		const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as unknown;
		if (
			typeof decoded !== 'object' ||
			decoded === null ||
			!('userId' in decoded) ||
			typeof (decoded as { userId: unknown }).userId !== 'number' ||
			!Number.isInteger((decoded as { userId: number }).userId) ||
			(decoded as { userId: number }).userId <= 0
		) {
			return null;
		}
		return { userId: (decoded as { userId: number }).userId };
	} catch {
		return null;
	}
}

export function getAuthCookieOptions() {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 24 * 7
	};
}
