import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: [
      'src/__tests__/**/*.{test,spec}.{ts,tsx}',
      'src/__tests__/critical-flows/**/*.{test,spec}.{ts,tsx}',
      'src/__tests__/integration/**/*.{test,spec}.{ts,tsx}'
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/__tests__/**/*'
      ],
      exclude: [
        'src/integrations/**/*',
        'src/components/ui/**/*',
        'src/vite-env.d.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})