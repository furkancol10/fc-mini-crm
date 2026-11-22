import type { WorkType } from './metadata';

export const ALL_WORK_STATUSES = [
	'new',
	'quoted',
	'approved',
	'in_progress',
	'waiting',
	'ready',
	'delivered',
	'cancelled'
] as const;

export type WorkStatus = (typeof ALL_WORK_STATUSES)[number];

export const ALLOWED_TRANSITIONS: Record<WorkStatus, readonly WorkStatus[]> = {
	new: ['quoted', 'approved', 'cancelled'],
	quoted: ['approved', 'cancelled'],
	approved: ['in_progress', 'waiting', 'cancelled'],
	in_progress: ['waiting', 'ready', 'cancelled'],
	waiting: ['in_progress', 'ready', 'cancelled'],
	ready: ['delivered', 'in_progress', 'cancelled'],
	delivered: [],
	cancelled: []
};

export class InvalidStatusTransitionError extends Error {
	readonly from: WorkStatus;
	readonly to: WorkStatus;

	constructor(from: WorkStatus, to: WorkStatus) {
		super(`Geçersiz durum geçişi: ${from} → ${to}`);
		this.name = 'InvalidStatusTransitionError';
		this.from = from;
		this.to = to;
	}
}

export function canTransition(from: WorkStatus, to: WorkStatus): boolean {
	return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: WorkStatus, to: WorkStatus): void {
	if (!canTransition(from, to)) {
		throw new InvalidStatusTransitionError(from, to);
	}
}

export function getAllowedNextStatuses(from: WorkStatus): readonly WorkStatus[] {
	return ALLOWED_TRANSITIONS[from];
}

const SERVICE_STATUS_LABELS: Record<WorkStatus, string> = {
	new: 'Kabul Alındı',
	quoted: 'Teklif Verildi',
	approved: 'Onaylandı',
	in_progress: 'Onarımda',
	waiting: 'Parça / Onay Bekliyor',
	ready: 'Teslime Hazır',
	delivered: 'Teslim Edildi',
	cancelled: 'İptal'
};

const AGENCY_STATUS_LABELS: Record<WorkStatus, string> = {
	new: 'Talep / Lead',
	quoted: 'Teklif Gönderildi',
	approved: 'Onaylandı',
	in_progress: 'Üretimde',
	waiting: 'Müşteri Geri Bildirimi',
	ready: 'Teslime Hazır',
	delivered: 'Teslim Edildi',
	cancelled: 'İptal'
};

export function getStatusLabel(status: WorkStatus, workType: WorkType = 'service'): string {
	return workType === 'agency' ? AGENCY_STATUS_LABELS[status] : SERVICE_STATUS_LABELS[status];
}
