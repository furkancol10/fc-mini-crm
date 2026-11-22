import crypto from 'node:crypto';
import { getDb } from '$lib/server/db/client';
import { resetDemoData } from '$lib/server/demo/seed';
import { getDemoResetSecret } from '$lib/server/env';
import { demoResetApiLimiter } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

function timingSafeMatch(provided: string, expected: string): boolean {
	const a = Buffer.from(provided, 'utf8');
	const b = Buffer.from(expected, 'utf8');
	if (a.length !== b.length) return false;
	return crypto.timingSafeEqual(a, b);
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const expectedSecret = getDemoResetSecret();
	if (!expectedSecret) {
		return new Response(JSON.stringify({ error: 'DEMO_RESET_SECRET sunucuda yapılandırılmamış' }), {
			status: 503,
			headers: { 'content-type': 'application/json' }
		});
	}

	const ip = (() => {
		try {
			return getClientAddress();
		} catch {
			return 'unknown';
		}
	})();

	const limitCheck = demoResetApiLimiter.check(`api-demo-reset:${ip}`);
	if (!limitCheck.allowed) {
		return new Response(
			JSON.stringify({ error: 'Çok fazla sıfırlama isteği. Lütfen biraz sonra tekrar deneyin.' }),
			{
				status: 429,
				headers: {
					'content-type': 'application/json',
					'retry-after': String(limitCheck.retryAfterSeconds)
				}
			}
		);
	}

	const provided = request.headers.get('x-demo-reset-secret')?.trim() ?? '';
	if (provided.length === 0 || !timingSafeMatch(provided, expectedSecret)) {
		return new Response(JSON.stringify({ error: 'Geçersiz veya eksik sıfırlama anahtarı' }), {
			status: 401,
			headers: { 'content-type': 'application/json' }
		});
	}

	const stats = await resetDemoData(getDb());
	return new Response(JSON.stringify({ ok: true, stats }), {
		status: 200,
		headers: {
			'content-type': 'application/json',
			'cache-control': 'no-store'
		}
	});
};
