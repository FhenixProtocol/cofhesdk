import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['test/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['src/**/*.ts'],
			exclude: [
				'node_modules/',
				'dist/',
				'test/',
				'src/examples.ts', // Example file doesn't need coverage
				'**/*.d.ts',
				'**/*.config.*',
			],
		},
	},
	resolve: {
		alias: {
			'@': '/src',
		},
	},
})
