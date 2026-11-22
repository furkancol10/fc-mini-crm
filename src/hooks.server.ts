import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { AUTH_COOKIE_NAME, verifySessionCookie } from '$lib/server/auth/cookie';
import { findUserById } from '$lib/server/auth/users';
import { getDb } from '$lib/server/db/client';

const PUBLIC_PATHS = ['/giris', '/api/auth/role'];

function isPublicPath(pathname: string): boolean {
	if (PUBLIC_PATHS.includes(pathname)) return true;
	if (pathname.startsWith('/takip/')) return true;
	return false;
}

function isAdminOnlyApiPath(pathname: string): boolean {
	return pathname === '/api/export' || pathname.startsWith('/api/export/');
}

export const handle: Handle = async ({ event, resolve }) => {
	const rawCookie = event.cookies.get(AUTH_COOKIE_NAME);
	const payload = verifySessionCookie(rawCookie);

	if (payload) {
		const user = await findUserById(getDb(), payload.userId);
		event.locals.user = user;
		if (!user) {
			event.cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
		}
	} else {
		event.locals.user = null;
	}

	const { pathname } = event.url;

	if (isAdminOnlyApiPath(pathname)) {
		if (!event.locals.user) {
			return new Response(JSON.stringify({ error: 'Oturum gerekli' }), {
				status: 401,
				headers: { 'content-type': 'application/json' }
			});
		}
		if (event.locals.user.role !== 'admin') {
			return new Response(JSON.stringify({ error: 'Bu işlem için Yönetici yetkisi gereklidir' }), {
				status: 403,
				headers: { 'content-type': 'application/json' }
			});
		}
	}

	if (!isPublicPath(pathname) && !event.locals.user) {
		if (pathname.startsWith('/api/') || event.request.method !== 'GET') {
			return new Response(JSON.stringify({ error: 'Oturum gerekli' }), {
				status: 401,
				headers: { 'content-type': 'application/json' }
			});
		}
		throw redirect(303, '/giris');
	}

	return resolve(event);
};
