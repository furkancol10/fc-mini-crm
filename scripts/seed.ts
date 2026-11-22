import { closeDb, getDb } from '../src/lib/server/db/client';
import { resetDemoData } from '../src/lib/server/demo/seed';

async function main() {
	const stats = await resetDemoData(getDb());
	console.log('Demo verisi yüklendi:', stats);
	await closeDb();
}

main().catch((err) => {
	console.error('Seed hatası:', err);
	process.exit(1);
});
