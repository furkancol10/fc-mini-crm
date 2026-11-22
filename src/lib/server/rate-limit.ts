export interface RateLimiterOptions {
	limit: number;
	windowMs: number;
	maxKeys?: number;
	now?: () => number;
}

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	retryAfterSeconds: number;
}

interface Bucket {
	count: number;
	resetAt: number;
}

export interface RateLimiter {
	check(key: string): RateLimitResult;
	reset(): void;
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
	const { limit, windowMs, maxKeys = 5_000, now = () => Date.now() } = options;
	const buckets = new Map<string, Bucket>();

	function prune(currentTime: number) {
		if (buckets.size < maxKeys) return;
		for (const [k, b] of buckets.entries()) {
			if (b.resetAt <= currentTime) {
				buckets.delete(k);
			}
		}
		if (buckets.size >= maxKeys) {
			const oldestKey = buckets.keys().next().value;
			if (oldestKey !== undefined) {
				buckets.delete(oldestKey);
			}
		}
	}

	function check(key: string): RateLimitResult {
		const currentTime = now();
		const existing = buckets.get(key);

		if (!existing || existing.resetAt <= currentTime) {
			prune(currentTime);
			buckets.set(key, { count: 1, resetAt: currentTime + windowMs });
			return {
				allowed: true,
				remaining: Math.max(0, limit - 1),
				retryAfterSeconds: 0
			};
		}

		if (existing.count >= limit) {
			const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - currentTime) / 1000));
			return {
				allowed: false,
				remaining: 0,
				retryAfterSeconds
			};
		}

		existing.count += 1;
		return {
			allowed: true,
			remaining: Math.max(0, limit - existing.count),
			retryAfterSeconds: 0
		};
	}

	function reset(): void {
		buckets.clear();
	}

	return { check, reset };
}

export const demoResetApiLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 });
export const panelDemoResetLimiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
export const trackingReadLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
export const trackingActionLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export function resetAllRateLimiters(): void {
	demoResetApiLimiter.reset();
	panelDemoResetLimiter.reset();
	trackingReadLimiter.reset();
	trackingActionLimiter.reset();
}
