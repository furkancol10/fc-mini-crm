import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { AuthUser } from '$lib/server/auth/types';
import { createDb, type Database } from '$lib/server/db/client';
import { users } from '$lib/server/db/schema';

export const TEST_DB_URL =
	process.env.TEST_DATABASE_URL ?? 'postgres://minicrm:minicrm@localhost:5438/minicrm_test';

let migrated = false;

export async function openTestDb() {
	const { db, sql: client } = createDb(TEST_DB_URL, { max: 10 });
	if (!migrated) {
		await migrate(db, { migrationsFolder: './drizzle' });
		migrated = true;
	}
	return { db, client };
}

export async function resetTestDb(db: Database): Promise<void> {
	await db.execute(
		sql`TRUNCATE TABLE payments, work_logs, quote_items, quotes, work_items, customers, users RESTART IDENTITY CASCADE`
	);
}

export async function seedTestUsers(db: Database): Promise<{
	admin: AuthUser;
	staff: AuthUser;
	otherStaff: AuthUser;
}> {
	const inserted = await db
		.insert(users)
		.values([
			{ name: 'Test Yönetici', role: 'admin', specialty: 'all' },
			{ name: 'Test Teknisyen', role: 'staff', specialty: 'service' },
			{ name: 'Diğer Teknisyen', role: 'staff', specialty: 'agency' }
		])
		.returning({
			id: users.id,
			name: users.name,
			role: users.role,
			specialty: users.specialty
		});

	return {
		admin: inserted[0],
		staff: inserted[1],
		otherStaff: inserted[2]
	};
}
