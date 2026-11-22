import { ensureDemoUsers } from '$lib/server/auth/users';
import { getDb } from '$lib/server/db/client';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const demoUsers = await ensureDemoUsers(getDb());
	return {
		user: locals.user,
		demoUsers
	};
};
