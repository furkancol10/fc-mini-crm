import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth/guard';
import { getDashboardSummary } from '$lib/server/crm/dashboard';
import { getDb } from '$lib/server/db/client';
import { resetDemoData } from '$lib/server/demo/seed';
import { toActionFail, toHttpError } from '$lib/server/http';
import { panelDemoResetLimiter } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const summary = await getDashboardSummary(getDb(), locals.user);
		return { summary };
	} catch (err) {
		toHttpError(err);
	}
};

export const actions: Actions = {
	resetDemo: async ({ locals, getClientAddress }) => {
		try {
			requireAdmin(locals.user);
		} catch (err) {
			return toActionFail(err);
		}

		const ip = (() => {
			try {
				return getClientAddress();
			} catch {
				return 'unknown';
			}
		})();

		const check = panelDemoResetLimiter.check(`panel-reset:${ip}`);
		if (!check.allowed) {
			return fail(429, {
				error: `Çok sık sıfırlama denemesi. Lütfen ${check.retryAfterSeconds} saniye sonra tekrar deneyin.`
			});
		}

		try {
			const stats = await resetDemoData(getDb());
			return {
				success: `Demo verisi sıfırlandı (${stats.customers} müşteri, ${stats.workItems} iş kaydı).`
			};
		} catch (err) {
			return toActionFail(err);
		}
	}
};
