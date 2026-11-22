import { redirect } from '@sveltejs/kit';
import { ALL_WORK_STATUSES, type WorkStatus } from '$lib/domain/status';
import { listUsers } from '$lib/server/auth/users';
import { listCustomers } from '$lib/server/crm/customers';
import {
	createWorkItem,
	deleteWorkItem,
	listWorkItems,
	transitionWorkItemStatus
} from '$lib/server/crm/work';
import { parseWorkItemQuery } from '$lib/server/crm/work-filters';
import { getDb } from '$lib/server/db/client';
import { toActionFail, toHttpError } from '$lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const db = getDb();
	const query = parseWorkItemQuery(url.searchParams);
	try {
		const [items, customerList, staffList] = await Promise.all([
			listWorkItems(db, locals.user, query.filters),
			listCustomers(db, locals.user),
			listUsers(db)
		]);
		return {
			workItems: items,
			customers: customerList,
			users: staffList,
			query: query.raw
		};
	} catch (err) {
		toHttpError(err);
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const form = await request.formData();
		const workType = form.get('workType') === 'agency' ? 'agency' : 'service';
		const assignedRaw = String(form.get('assignedTo') ?? '').trim();
		const dueRaw = String(form.get('dueDate') ?? '').trim();

		const metadata =
			workType === 'service'
				? {
						device: String(form.get('meta_device') ?? ''),
						brand: String(form.get('meta_brand') ?? ''),
						model: String(form.get('meta_model') ?? ''),
						serialNo: String(form.get('meta_serialNo') ?? ''),
						accessories: String(form.get('meta_accessories') ?? '')
					}
				: {
						channel: String(form.get('meta_channel') ?? ''),
						deliverableUrl: String(form.get('meta_deliverableUrl') ?? ''),
						brief: String(form.get('meta_brief') ?? '')
					};

		try {
			const created = await createWorkItem(getDb(), locals.user, {
				customerId: Number(form.get('customerId')),
				assignedTo: assignedRaw ? Number(assignedRaw) : null,
				workType,
				title: String(form.get('title') ?? ''),
				priority:
					form.get('priority') === 'high'
						? 'high'
						: form.get('priority') === 'low'
							? 'low'
							: 'normal',
				description: String(form.get('description') ?? ''),
				dueDate: dueRaw ? new Date(dueRaw) : null,
				metadata
			});
			throw redirect(303, `/isler/${created.id}`);
		} catch (err) {
			if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
				throw err;
			}
			return toActionFail(err);
		}
	},

	transition: async ({ request, locals }) => {
		const form = await request.formData();
		const workItemId = Number(form.get('workItemId'));
		const nextRaw = String(form.get('nextStatus') ?? '');
		if (!Number.isInteger(workItemId) || workItemId <= 0) {
			return toActionFail(new RangeError('Geçersiz iş kimliği'));
		}
		if (!ALL_WORK_STATUSES.includes(nextRaw as WorkStatus)) {
			return toActionFail(new RangeError('Geçersiz hedef durum'));
		}
		try {
			await transitionWorkItemStatus(
				getDb(),
				locals.user,
				workItemId,
				nextRaw as WorkStatus,
				undefined,
				true
			);
			return { success: 'İş durumu güncellendi.' };
		} catch (err) {
			return toActionFail(err);
		}
	},

	delete: async ({ request, locals }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		try {
			await deleteWorkItem(getDb(), locals.user, id);
			return { success: 'İş kaydı silindi.' };
		} catch (err) {
			return toActionFail(err);
		}
	}
};
