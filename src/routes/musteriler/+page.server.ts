import { createCustomer, deleteCustomer, listCustomers } from '$lib/server/crm/customers';
import { getDb } from '$lib/server/db/client';
import { toActionFail, toHttpError } from '$lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const customerList = await listCustomers(getDb(), locals.user);
		return { customers: customerList };
	} catch (err) {
		toHttpError(err);
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const form = await request.formData();
		try {
			await createCustomer(getDb(), locals.user, {
				name: String(form.get('name') ?? ''),
				company: String(form.get('company') ?? ''),
				phone: String(form.get('phone') ?? ''),
				email: String(form.get('email') ?? ''),
				taxNo: String(form.get('taxNo') ?? ''),
				kind: form.get('kind') === 'active' ? 'active' : 'lead',
				notes: String(form.get('notes') ?? '')
			});
			return { success: 'Müşteri kaydedildi.' };
		} catch (err) {
			return toActionFail(err);
		}
	},

	delete: async ({ request, locals }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		try {
			await deleteCustomer(getDb(), locals.user, id);
			return { success: 'Müşteri silindi.' };
		} catch (err) {
			return toActionFail(err);
		}
	}
};
