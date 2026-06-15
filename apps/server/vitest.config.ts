import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    pool: 'forks', // <== The magic fix: runs tests in separate processes, not threads
    globals: true,
    testTimeout: 10000
  },
});
