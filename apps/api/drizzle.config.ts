import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'drizzle-kit';

const repoRoot = path.resolve(process.cwd(), '../..');
const envFile = path.join(repoRoot, '.env');

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  schema: '../../packages/contracts/src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://courtly:courtly@localhost:5432/courtly',
  },
});
