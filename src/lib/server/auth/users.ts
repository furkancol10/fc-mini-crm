import { asc, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { users } from '../db/schema';
import type { AuthUser, UserRole } from './types';

export async function findUserById(db: Database, userId: number): Promise<AuthUser | null> {
	const [row] = await db
		.select({
			id: users.id,
			name: users.name,
			role: users.role,
			specialty: users.specialty
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	return row ?? null;
}

export async function listUsers(db: Database): Promise<AuthUser[]> {
	return db
		.select({
			id: users.id,
			name: users.name,
			role: users.role,
			specialty: users.specialty
		})
		.from(users)
		.orderBy(asc(users.id));
}

export async function ensureDemoUsers(db: Database): Promise<AuthUser[]> {
	const existing = await listUsers(db);
	if (existing.length > 0) {
		return existing;
	}

	const inserted = await db
		.insert(users)
		.values([
			{ name: 'Demet Kaya (Yönetici)', role: 'admin', specialty: 'all' },
			{ name: 'Kerem Arslan (Teknisyen)', role: 'staff', specialty: 'service' }
		])
		.returning({
			id: users.id,
			name: users.name,
			role: users.role,
			specialty: users.specialty
		});

	return inserted;
}

export async function findFirstUserByRole(db: Database, role: UserRole): Promise<AuthUser | null> {
	const all = await ensureDemoUsers(db);
	return all.find((u) => u.role === role) ?? null;
}
