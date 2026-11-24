import crypto from 'node:crypto';
import { getDb } from '$lib/server/db/client';
import { resetDemoData } from '$lib/server/demo/seed';
import { getCronSecret } from '$lib/server/env';
import type { RequestHandler } from './$types';

function timingSafeMatch(provided: string, expected: string): boolean {
	const a = Buffer.from(provided, 'utf8');
	const b = Buffer.from(expected, 'utf8');
	if (a.length !== b.length) return false;
	return crypto.timingSafeEqual(a, b);
}

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
	});
}

// Vercel Cron: GET + "Authorization: Bearer <CRON_SECRET>"
export const GET: RequestHandler = async ({ request }) => {
	const expected = getCronSecret();
	if (!expected) {
		return json({ error: 'CRON_SECRET sunucuda yapılandırılmamış' }, 503);
	}

	const header = request.headers.get('authorization')?.trim() ?? '';
	const match = /^Bearer\s+(.+)$/i.exec(header);
	if (!match || !timingSafeMatch(match[1].trim(), expected)) {
		return json({ error: 'Geçersiz veya eksik yetkilendirme' }, 401);
	}

	const stats = await resetDemoData(getDb());
	return json({ ok: true, stats }, 200);
};
