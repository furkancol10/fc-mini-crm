import { defineConfig, devices } from '@playwright/test';

try {
	process.loadEnvFile('.env');
} catch {
	// .env yoksa varsayılan yerel değerler kullanılır
}

const PORT = Number(process.env.E2E_PORT ?? 4173);
const DATABASE_URL =
	process.env.DATABASE_URL ?? 'postgres://minicrm:minicrm@localhost:5438/minicrm';
const DEMO_RESET_SECRET = process.env.DEMO_RESET_SECRET ?? 'dev-only-demo-reset-secret-change-me';
const AUTH_COOKIE_SECRET =
	process.env.AUTH_COOKIE_SECRET ?? 'dev-only-change-me-at-least-32-bytes-long';

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	globalSetup: './e2e/global-setup.ts',
	// Tek PostgreSQL veritabanına yazan akışlar: çakışmasız sıralı çalışma
	workers: 1,
	fullyParallel: false,
	retries: 0,
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		locale: 'tr-TR',
		timezoneId: 'Europe/Istanbul'
	},
	projects: [
		{
			name: 'mobil-360',
			use: { ...devices['Pixel 7'], viewport: { width: 360, height: 740 } }
		},
		{
			name: 'masaustu',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }
		}
	],
	webServer: {
		command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
		url: `http://127.0.0.1:${PORT}/giris`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			DATABASE_URL,
			AUTH_COOKIE_SECRET,
			DEMO_RESET_SECRET,
			PANEL_DEMO_RESET_RATE_LIMIT: '100',
			DEMO_RESET_API_RATE_LIMIT: '100'
		}
	}
});
