import { fail, redirect } from '@sveltejs/kit';
import { AUTH_COOKIE_NAME, getAuthCookieOptions, signSessionCookie } from '$lib/server/auth/cookie';
import { ensureDemoUsers, findFirstUserByRole, findUserById } from '$lib/server/auth/users';
import { getDb } from '$lib/server/db/client';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const demoUsers = await ensureDemoUsers(getDb());
	return {
		user: locals.user,
		demoUsers
	};
};

export const actions: Actions = {
	switchRole: async ({ request, cookies }) => {
		const form = await request.formData();
		const userIdRaw = form.get('userId');
		const roleRaw = form.get('role');
		const db = getDb();

		let target = null;
		if (typeof userIdRaw === 'string' && userIdRaw.trim().length > 0) {
			const id = Number(userIdRaw);
			if (Number.isInteger(id) && id > 0) {
				target = await findUserById(db, id);
			}
		} else if (roleRaw === 'admin' || roleRaw === 'staff') {
			target = await findFirstUserByRole(db, roleRaw);
		}

		if (!target) {
			return fail(404, { error: 'Kullanıcı bulunamadı' });
		}

		const signed = signSessionCookie({ userId: target.id });
		cookies.set(AUTH_COOKIE_NAME, signed, getAuthCookieOptions());

		const next = form.get('redirectTo');
		const targetPath =
			typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/isler';

		throw redirect(303, targetPath);
	},

	logout: async ({ cookies }) => {
		cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
		throw redirect(303, '/giris');
	}
};
