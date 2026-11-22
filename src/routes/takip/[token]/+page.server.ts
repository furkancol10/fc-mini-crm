import { error, fail } from '@sveltejs/kit';
import {
	approveQuoteByToken,
	getPublicWorkItemByToken,
	rejectQuoteByToken
} from '$lib/server/crm/tracking';
import { getDb } from '$lib/server/db/client';
import { toActionFail, toHttpError } from '$lib/server/http';
import { trackingActionLimiter, trackingReadLimiter } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad } from './$types';

function safeClientIp(getClientAddress: () => string): string {
	try {
		return getClientAddress();
	} catch {
		return 'unknown';
	}
}

export const load: PageServerLoad = async ({ params, getClientAddress }) => {
	const ip = safeClientIp(getClientAddress);
	const limit = trackingReadLimiter.check(`takip-read:${ip}`);
	if (!limit.allowed) {
		throw error(429, 'Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.');
	}

	try {
		return await getPublicWorkItemByToken(getDb(), params.token);
	} catch (err) {
		toHttpError(err);
	}
};

export const actions: Actions = {
	approveQuote: async ({ params, request, getClientAddress }) => {
		const ip = safeClientIp(getClientAddress);
		const limit = trackingActionLimiter.check(`takip-act:${ip}:${params.token}`);
		if (!limit.allowed) {
			return fail(429, {
				error: `Çok fazla işlem denemesi. Lütfen ${limit.retryAfterSeconds} saniye sonra tekrar deneyin.`
			});
		}

		const form = await request.formData();
		const quoteId = Number(form.get('quoteId'));
		if (!Number.isInteger(quoteId) || quoteId <= 0) {
			return fail(400, { error: 'Geçersiz teklif kimliği' });
		}

		try {
			await approveQuoteByToken(getDb(), params.token, quoteId);
			return { success: 'Teklifiniz onaylandı. İşleminiz sıraya alınmıştır.' };
		} catch (err) {
			return toActionFail(err);
		}
	},

	rejectQuote: async ({ params, request, getClientAddress }) => {
		const ip = safeClientIp(getClientAddress);
		const limit = trackingActionLimiter.check(`takip-act:${ip}:${params.token}`);
		if (!limit.allowed) {
			return fail(429, {
				error: `Çok fazla işlem denemesi. Lütfen ${limit.retryAfterSeconds} saniye sonra tekrar deneyin.`
			});
		}

		const form = await request.formData();
		const quoteId = Number(form.get('quoteId'));
		if (!Number.isInteger(quoteId) || quoteId <= 0) {
			return fail(400, { error: 'Geçersiz teklif kimliği' });
		}

		try {
			await rejectQuoteByToken(getDb(), params.token, quoteId);
			return { success: 'Teklif reddedildi. Ekibimiz sizinle iletişime geçecektir.' };
		} catch (err) {
			return toActionFail(err);
		}
	}
};
