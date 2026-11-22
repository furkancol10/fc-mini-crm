export class NotFoundError extends Error {
	readonly status = 404;

	constructor(message = 'Kayıt bulunamadı') {
		super(message);
		this.name = 'NotFoundError';
	}
}

export class ConflictError extends Error {
	readonly status = 409;

	constructor(message: string) {
		super(message);
		this.name = 'ConflictError';
	}
}

export class ValidationError extends Error {
	readonly status = 400;

	constructor(message: string) {
		super(message);
		this.name = 'ValidationError';
	}
}

interface PgLikeError {
	code?: string;
	constraint?: string;
	constraint_name?: string;
	cause?: PgLikeError;
}

function extractPgError(err: unknown): PgLikeError | null {
	if (!err || typeof err !== 'object') return null;
	const obj = err as PgLikeError;
	if (typeof obj.code === 'string') return obj;
	if (obj.cause && typeof obj.cause === 'object' && typeof obj.cause.code === 'string') {
		return obj.cause;
	}
	return null;
}

export function isPgUniqueViolation(err: unknown, constraintName?: string): boolean {
	const pgErr = extractPgError(err);
	if (!pgErr || pgErr.code !== '23505') return false;
	if (!constraintName) return true;
	const actual = pgErr.constraint ?? pgErr.constraint_name;
	return actual === constraintName;
}

export function isPgForeignKeyViolation(err: unknown): boolean {
	const pgErr = extractPgError(err);
	return pgErr?.code === '23503';
}
