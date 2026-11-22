import type { WorkType } from '$lib/domain/metadata';
import { ALL_WORK_STATUSES, type WorkStatus } from '$lib/domain/status';
import type { WorkItemFilters } from './work';

export interface ParsedWorkQuery {
	view: 'list' | 'kanban';
	filters: WorkItemFilters;
	raw: {
		view: 'list' | 'kanban';
		q: string;
		status: string;
		workType: string;
		priority: string;
		assignedTo: string;
		overdue: boolean;
	};
}

export function parseWorkItemQuery(searchParams: URLSearchParams): ParsedWorkQuery {
	const view: 'list' | 'kanban' = searchParams.get('view') === 'kanban' ? 'kanban' : 'list';
	const q = (searchParams.get('q') ?? '').trim();

	const statusRaw = (searchParams.get('status') ?? '').trim();
	const status = ALL_WORK_STATUSES.includes(statusRaw as WorkStatus)
		? (statusRaw as WorkStatus)
		: null;

	const workTypeRaw = (searchParams.get('workType') ?? '').trim();
	const workType: WorkType | null =
		workTypeRaw === 'service' || workTypeRaw === 'agency' ? workTypeRaw : null;

	const priorityRaw = (searchParams.get('priority') ?? '').trim();
	const priority: 'low' | 'normal' | 'high' | null =
		priorityRaw === 'low' || priorityRaw === 'normal' || priorityRaw === 'high'
			? priorityRaw
			: null;

	const assignedRaw = (searchParams.get('assignedTo') ?? '').trim();
	let assignedTo: number | 'unassigned' | null = null;
	if (assignedRaw === 'unassigned') {
		assignedTo = 'unassigned';
	} else if (assignedRaw.length > 0) {
		const n = Number(assignedRaw);
		if (Number.isInteger(n) && n > 0) {
			assignedTo = n;
		}
	}

	const overdue = searchParams.get('overdue') === '1' || searchParams.get('overdue') === 'true';

	return {
		view,
		filters: {
			q: q.length > 0 ? q : null,
			status,
			workType,
			priority,
			assignedTo,
			overdue
		},
		raw: {
			view,
			q,
			status: status ?? '',
			workType: workType ?? '',
			priority: priority ?? '',
			assignedTo: assignedTo === null ? '' : String(assignedTo),
			overdue
		}
	};
}
