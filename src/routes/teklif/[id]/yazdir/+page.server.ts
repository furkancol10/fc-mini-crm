import { getQuoteWithDetails } from '$lib/server/crm/quotes';
import { getDb } from '$lib/server/db/client';
import { parsePositiveIntParam, toHttpError } from '$lib/server/http';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parsePositiveIntParam(params.id, 'teklif');
	try {
		return await getQuoteWithDetails(getDb(), locals.user, id);
	} catch (err) {
		toHttpError(err);
	}
};
