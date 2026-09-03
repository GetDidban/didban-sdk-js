import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@didban/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      'react-native': fileURLToPath(
        new URL('./packages/react-native/test/react-native.mock.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    restoreMocks: true,
    include: ['packages/*/test/**/*.test.ts'],
  },
});
