import { tlToKurus } from '$lib/domain/money';
import { ALL_WORK_STATUSES, type WorkStatus } from '$lib/domain/status';
import { addPayment, deletePayment } from '$lib/server/crm/payments';
import {
	approveQuote,
	createQuote,
	rejectQuote,
	reviseQuote,
	sendQuote,
	updateDraftQuote
} from '$lib/server/crm/quotes';
import { addWorkLog, getWorkItemDetail, transitionWorkItemStatus } from '$lib/server/crm/work';
import { getDb } from '$lib/server/db/client';
import { parsePositiveIntParam, toActionFail, toHttpError } from '$lib/server/http';
import type { Actions, PageServerLoad } from './$types';

function parseQuoteItemsFromForm(form: FormData) {
	const kinds = form.getAll('item_kind').map(String);
	const descriptions = form.getAll('item_description').map(String);
	const qtys = form.getAll('item_qty').map(String);
	const prices = form.getAll('item_unitPriceTl').map(String);
	const vatRates = form.getAll('item_vatRate').map(String);

	const count = descriptions.length;
	const items = [];
	for (let i = 0; i < count; i++) {
		const desc = descriptions[i]?.trim() ?? '';
		if (!desc) continue;
		const kindRaw = kinds[i];
		const kind: 'part' | 'labor' | 'service' =
			kindRaw === 'part' ? 'part' : kindRaw === 'labor' ? 'labor' : 'service';
		const qty = Number(String(qtys[i] ?? '1').replace(',', '.'));
		const unitPriceKurus = tlToKurus(prices[i] ?? '0');
		const vatRate = Number(vatRates[i] ?? '20');
		items.push({ kind, description: desc, qty, unitPriceKurus, vatRate });
	}
	return items;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parsePositiveIntParam(params.id, 'iş');
	try {
		return await getWorkItemDetail(getDb(), locals.user, id);
	} catch (err) {
		toHttpError(err);
	}
};

export const actions: Actions = {
	transition: async ({ params, request, locals }) => {
		const id = parsePositiveIntParam(params.id, 'iş');
		const form = await request.formData();
		const nextRaw = String(form.get('nextStatus') ?? '');
		if (!ALL_WORK_STATUSES.includes(nextRaw as WorkStatus)) {
			return toActionFail(new RangeError('Geçersiz hedef durum'));
		}
		try {
			await transitionWorkItemStatus(
				getDb(),
				locals.user,
				id,
				nextRaw as WorkStatus,
				String(form.get('note') ?? ''),
				form.get('isPublic') === 'on'
			);
			return { success: 'Durum güncellendi.' };
		} catch (err) {
			return toActionFail(err);
		}
	},

	addLog: async ({ params, request, locals }) => {
		const id = parsePositiveIntParam(params.id, 'iş');
		const form = await request.formData();
		try {
			await addWorkLog(getDb(), locals.user, id, {
				message: String(form.get('message') ?? ''),
				isPublic: form.get('isPublic') === 'on'
			});
			return { success: 'Not eklendi.' };
		} catch (err) {
			return toActionFail(err);
		}
	},

	createQuote: async ({ params, request, locals }) => {
		const id = parsePositiveIntParam(params.id, 'iş');
		const form = await request.formData();
		const validUntilRaw = String(form.get('validUntil') ?? '').trim();
		try {
			const items = parseQuoteItemsFromForm(form);
			await createQuote(getDb(), locals.user, {
				workItemId: id,
				vatIncluded: form.get('vatIncluded') === 'true',
				notes: String(form.get('notes') ?? ''),
				validUntil: validUntilRaw ? new Date(validUntilRaw) : null,
				items
			});
			return { success: 'Taslak teklif oluşturuldu.' };
		} catch (err) {
			return toActionFail(err);
		}
	},

	updateDraftQuote: async ({ request, locals }) => {
		const form = await request.formData();
		const quoteId = Number(form.get('quoteId'));
		const validUntilRaw = String(form.get('validUntil') ?? '').trim();
		try {
			const items = parseQuoteItemsFromForm(form);
			await updateDraftQuote(getDb(), locals.user, quoteId, {
				vatIncluded: form.get('vatIncluded') === 'true',
				notes: String(form.get('notes') ?? ''),
				validUntil: validUntilRaw ? new Date(validUntilRaw) : null,
				items
			});
			return { success: 'Taslak teklif güncellendi.' };
		} catch (err) {
			return toActionFail(err);
		}
	},

	sendQuote: async ({ request, locals }) => {
		const form = await request.formData();
		const quoteId = Number(form.get('quoteId'));
		try {
			await sendQuote(getDb(), locals.user, quoteId);
			return { success: 'Teklif gönderildi.' };
		} catch (err) {
			return toActionFail(err);
		}
	},

	approveQuote: async ({ request, locals }) => {
		const form = await request.formData();
		const quoteId = Number(form.get('quoteId'));
		try {
			await approveQuote(getDb(), locals.user, quoteId);
			return { success: 'Teklif onaylandı.' };
		} catch (err) {
			return toActionFail(err);
		}
	},

	rejectQuote: async ({ request, locals }) => {
		const form = await request.formData();
		const quoteId = Number(form.get('quoteId'));
		try {
			await rejectQuote(getDb(), locals.user, quoteId);
			return { success: 'Teklif reddedildi.' };
		} catch (err) {
			return toActionFail(err);
		}
	},

	reviseQuote: async ({ request, locals }) => {
		const form = await request.formData();
		const quoteId = Number(form.get('quoteId'));
		try {
			await reviseQuote(getDb(), locals.user, quoteId);
			return { success: 'Yeni teklif revizyonu (taslak) oluşturuldu.' };
		} catch (err) {
			return toActionFail(err);
		}
	},

	addPayment: async ({ params, request, locals }) => {
		const id = parsePositiveIntParam(params.id, 'iş');
		const form = await request.formData();
		const methodRaw = String(form.get('method') ?? 'cash');
		const method: 'cash' | 'card' | 'transfer' =
			methodRaw === 'card' ? 'card' : methodRaw === 'transfer' ? 'transfer' : 'cash';
		try {
			const amountKurus = tlToKurus(String(form.get('amountTl') ?? ''));
			await addPayment(getDb(), locals.user, {
				workItemId: id,
				amountKurus,
				method,
				invoiceRef: String(form.get('invoiceRef') ?? ''),
				note: String(form.get('note') ?? '')
			});
			return { success: 'Tahsilat kaydedildi.' };
		} catch (err) {
			return toActionFail(err);
		}
	},

	deletePayment: async ({ request, locals }) => {
		const form = await request.formData();
		const paymentId = Number(form.get('paymentId'));
		try {
			await deletePayment(getDb(), locals.user, paymentId);
			return { success: 'Tahsilat silindi.' };
		} catch (err) {
			return toActionFail(err);
		}
	}
};
