import { error, fail } from '@sveltejs/kit';
import { ZodError } from 'zod';
import { InvalidStatusTransitionError } from '$lib/domain/status';
import { AuthError } from '$lib/server/auth/guard';
import { ConflictError, NotFoundError, ValidationError } from '$lib/server/crm/errors';

export function toHttpError(err: unknown): never {
	if (err instanceof AuthError) {
		throw error(err.status, err.message);
	}
	if (err instanceof NotFoundError) {
		throw error(404, err.message);
	}
	if (err instanceof ConflictError) {
		throw error(409, err.message);
	}
	if (err instanceof ValidationError || err instanceof InvalidStatusTransitionError) {
		throw error(400, err.message);
	}
	if (err instanceof ZodError) {
		const msg = err.issues.map((i) => i.message).join('; ') || 'Geçersiz veri';
		throw error(400, msg);
	}
	throw err;
}

export function toActionFail(err: unknown) {
	if (err instanceof AuthError) {
		return fail(err.status, { error: err.message });
	}
	if (err instanceof NotFoundError) {
		return fail(404, { error: err.message });
	}
	if (err instanceof ConflictError) {
		return fail(409, { error: err.message });
	}
	if (
		err instanceof ValidationError ||
		err instanceof InvalidStatusTransitionError ||
		err instanceof RangeError
	) {
		return fail(400, { error: err.message });
	}
	if (err instanceof ZodError) {
		const msg = err.issues.map((i) => i.message).join('; ') || 'Geçersiz form verisi';
		return fail(400, { error: msg });
	}
	throw err;
}

export function parsePositiveIntParam(raw: string, label = 'Kayıt'): number {
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) {
		throw error(400, `Geçersiz ${label} kimliği`);
	}
	return id;
}
