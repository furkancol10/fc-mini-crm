import { getCustomerWithWorkItems, updateCustomer } from '$lib/server/crm/customers';
import { getDb } from '$lib/server/db/client';
import { parsePositiveIntParam, toActionFail, toHttpError } from '$lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parsePositiveIntParam(params.id, 'müşteri');
	try {
		return await getCustomerWithWorkItems(getDb(), locals.user, id);
	} catch (err) {
		toHttpError(err);
	}
};

export const actions: Actions = {
	update: async ({ params, request, locals }) => {
		const id = parsePositiveIntParam(params.id, 'müşteri');
		const form = await request.formData();
		try {
			await updateCustomer(getDb(), locals.user, id, {
				name: String(form.get('name') ?? ''),
				company: String(form.get('company') ?? ''),
				phone: String(form.get('phone') ?? ''),
				email: String(form.get('email') ?? ''),
				taxNo: String(form.get('taxNo') ?? ''),
				kind: form.get('kind') === 'active' ? 'active' : 'lead',
				notes: String(form.get('notes') ?? '')
			});
			return { success: 'Müşteri bilgileri güncellendi.' };
		} catch (err) {
			return toActionFail(err);
		}
	}
};
