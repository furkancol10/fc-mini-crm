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
