import path from 'node:path';
import { defineConfig } from 'vitest/config';

const alias = {
	$lib: path.resolve('./src/lib')
};

export default defineConfig({
	resolve: { alias },
	test: {
		projects: [
			{
				resolve: { alias },
				test: {
					name: 'unit',
					environment: 'node',
					include: ['tests/unit/**/*.test.ts']
				}
			},
			{
				resolve: { alias },
				test: {
					name: 'integration',
					environment: 'node',
					include: ['tests/integration/**/*.test.ts'],
					fileParallelism: false,
					testTimeout: 20_000,
					hookTimeout: 20_000
				}
			}
		]
	}
});
