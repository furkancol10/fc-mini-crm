import { describe, expect, it } from 'vitest';
import { signSessionCookie, verifySessionCookie } from '$lib/server/auth/cookie';
import {
	AuthError,
	canAccessWorkItem,
	requireAdmin,
	requireUser,
	requireWorkItemAccess
} from '$lib/server/auth/guard';
import type { AuthUser } from '$lib/server/auth/types';

describe('auth signed cookie & role guards', () => {
	const secret = 'test-secret-key-at-least-32-chars-long';
	const admin: AuthUser = { id: 1, name: 'Yönetici', role: 'admin', specialty: 'all' };
	const staff: AuthUser = { id: 2, name: 'Teknisyen', role: 'staff', specialty: 'service' };

	it('imzalı cookie üretir ve aynı anahtarla doğrular', () => {
		const token = signSessionCookie({ userId: 2 }, secret);
		const payload = verifySessionCookie(token, secret);
		expect(payload).toEqual({ userId: 2 });
	});

	it('kurcalanmış veya yanlış anahtarlı cookie imzasını reddeder', () => {
		const token = signSessionCookie({ userId: 2 }, secret);
		const [body, sig] = token.split('.');
		// payload değişikliği
		const tamperedBody = Buffer.from(JSON.stringify({ userId: 1 })).toString('base64url');
		expect(verifySessionCookie(`${tamperedBody}.${sig}`, secret)).toBeNull();
		// yanlış imza
		expect(verifySessionCookie(`${body}.invalid-signature`, secret)).toBeNull();
		// yanlış secret
		expect(verifySessionCookie(token, 'another-secret-key-at-least-32-chars')).toBeNull();
		// bozuk biçim
		expect(verifySessionCookie('', secret)).toBeNull();
		expect(verifySessionCookie('no-dot', secret)).toBeNull();
	});

	it('requireUser oturumsuz istekte 401 fırlatır', () => {
		expect(() => requireUser(null)).toThrow(AuthError);
		try {
			requireUser(null);
		} catch (err) {
			expect((err as AuthError).status).toBe(401);
		}
		expect(requireUser(staff)).toEqual(staff);
	});

	it('requireAdmin staff için 403, oturumsuz için 401 fırlatır', () => {
		expect(() => requireAdmin(null)).toThrow(AuthError);
		try {
			requireAdmin(staff);
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(AuthError);
			expect((err as AuthError).status).toBe(403);
		}
		expect(requireAdmin(admin)).toEqual(admin);
	});

	it('staff yalnız kendisine atanmış işe erişebilir; atanmamış işte 403 alır', () => {
		expect(canAccessWorkItem(admin, { assignedTo: null })).toBe(true);
		expect(canAccessWorkItem(admin, { assignedTo: 99 })).toBe(true);

		expect(canAccessWorkItem(staff, { assignedTo: 2 })).toBe(true);
		expect(canAccessWorkItem(staff, { assignedTo: 1 })).toBe(false);
		expect(canAccessWorkItem(staff, { assignedTo: null })).toBe(false);

		expect(() => requireWorkItemAccess(staff, { assignedTo: 2 })).not.toThrow();
		try {
			requireWorkItemAccess(staff, { assignedTo: null });
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(AuthError);
			expect((err as AuthError).status).toBe(403);
		}
	});
});
