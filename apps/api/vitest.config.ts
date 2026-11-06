import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@courtly/contracts': path.resolve(process.cwd(), '../../packages/contracts/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    globalSetup: ['./test/db/global-setup.ts'],
    // DB tests share one Postgres database, so files must not truncate each
    // other's fixtures concurrently.
    fileParallelism: false,
  },
});
