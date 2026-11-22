import { execFileSync } from 'node:child_process';

const DEFAULT_DB_URL = 'postgres://minicrm:minicrm@localhost:5438/minicrm';

/** E2E koşusundan önce migrasyonları uygular ve deterministik demo verisini yükler. */
export default async function globalSetup() {
	const env = {
		...process.env,
		DATABASE_URL: process.env.DATABASE_URL ?? DEFAULT_DB_URL
	};

	const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
	execFileSync(npxCmd, ['tsx', 'scripts/migrate.ts'], { stdio: 'inherit', env });
	execFileSync(npxCmd, ['tsx', 'scripts/seed.ts'], { stdio: 'inherit', env });
}
