import type { AuthUser } from './types';

export class AuthError extends Error {
	readonly status: 401 | 403;

	constructor(status: 401 | 403, message: string) {
		super(message);
		this.name = 'AuthError';
		this.status = status;
	}
}

export function requireUser(user: AuthUser | null | undefined): AuthUser {
	if (!user) {
		throw new AuthError(401, 'Oturum gerekli');
	}
	return user;
}

export function requireAdmin(user: AuthUser | null | undefined): AuthUser {
	const authed = requireUser(user);
	if (authed.role !== 'admin') {
		throw new AuthError(403, 'Bu işlem için Yönetici yetkisi gereklidir');
	}
	return authed;
}

export function canAccessWorkItem(
	user: AuthUser,
	workItem: { assignedTo: number | null }
): boolean {
	if (user.role === 'admin') {
		return true;
	}
	return workItem.assignedTo !== null && workItem.assignedTo === user.id;
}

export function requireWorkItemAccess(
	user: AuthUser | null | undefined,
	workItem: { assignedTo: number | null }
): AuthUser {
	const authed = requireUser(user);
	if (!canAccessWorkItem(authed, workItem)) {
		throw new AuthError(403, 'Bu iş kaydına erişim yetkiniz yok');
	}
	return authed;
}
