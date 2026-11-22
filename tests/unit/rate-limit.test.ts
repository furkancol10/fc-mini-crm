import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '$lib/server/rate-limit';

describe('rate-limit (bellek içi pencere sınırlayıcı)', () => {
	it('limite kadar izin verir, aşılınca retryAfterSeconds ile reddeder', () => {
		let now = 1_000_000;
		const limiter = createRateLimiter({
			limit: 3,
			windowMs: 60_000,
			now: () => now
		});

		expect(limiter.check('ip:1')).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
		expect(limiter.check('ip:1')).toEqual({ allowed: true, remaining: 1, retryAfterSeconds: 0 });
		expect(limiter.check('ip:1')).toEqual({ allowed: true, remaining: 0, retryAfterSeconds: 0 });

		const blocked = limiter.check('ip:1');
		expect(blocked.allowed).toBe(false);
		expect(blocked.remaining).toBe(0);
		expect(blocked.retryAfterSeconds).toBe(60);

		// Farklı anahtar etkilenmez
		expect(limiter.check('ip:2').allowed).toBe(true);

		// Pencere dolunca yeniden izin verir
		now += 60_001;
		expect(limiter.check('ip:1')).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
	});

	it('reset() tüm kayıtları temizler', () => {
		const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
		expect(limiter.check('k').allowed).toBe(true);
		expect(limiter.check('k').allowed).toBe(false);

		limiter.reset();
		expect(limiter.check('k').allowed).toBe(true);
	});
});

describe('hız sınırı env geçersiz kılma', () => {
	async function loadLimit(env: Record<string, string | undefined>) {
		const { vi } = await import('vitest');
		vi.resetModules();
		vi.unstubAllEnvs();
		for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
		const mod = await import('$lib/server/rate-limit');
		let allowed = 0;
		while (mod.panelDemoResetLimiter.check('k').allowed && allowed < 500) allowed++;
		vi.unstubAllEnvs();
		return allowed;
	}

	it('yerelde PANEL_DEMO_RESET_RATE_LIMIT uygulanır', async () => {
		expect(await loadLimit({ VERCEL: '', PANEL_DEMO_RESET_RATE_LIMIT: '100' })).toBe(100);
	});

	it('VERCEL ortamında geçersiz kılma yok sayılır (varsayılan 3)', async () => {
		expect(await loadLimit({ VERCEL: '1', PANEL_DEMO_RESET_RATE_LIMIT: '100' })).toBe(3);
	});
});
