import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { getDatabaseUrl } from '../src/lib/server/env';

async function main() {
	const url = getDatabaseUrl();
	const sql = postgres(url, { max: 1 });
	try {
		const db = drizzle(sql);
		await migrate(db, { migrationsFolder: './drizzle' });
		console.log('Migrasyonlar başarıyla uygulandı.');
	} finally {
		await sql.end();
	}
}

main().catch((err) => {
	console.error('Migrasyon hatası:', err);
	process.exit(1);
});
