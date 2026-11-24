import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseUrl } from '../env';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

let cachedClient: postgres.Sql | null = null;
let cachedDb: Database | null = null;

export function createDb(connectionString: string, options?: { max?: number }) {
	const sql = postgres(connectionString, {
		max: options?.max ?? 5,
		idle_timeout: 20,
		connect_timeout: 10,
		// Supabase/PgBouncer transaction pooler does not support prepared statements.
		prepare: false
	});
	const db = drizzle(sql, { schema });
	return { db, sql };
}

export function getDb(): Database {
	if (!cachedDb) {
		const { db, sql } = createDb(getDatabaseUrl());
		cachedClient = sql;
		cachedDb = db;
	}
	return cachedDb;
}

export async function closeDb(): Promise<void> {
	if (cachedClient) {
		await cachedClient.end();
		cachedClient = null;
		cachedDb = null;
	}
}
