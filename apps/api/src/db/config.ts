import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Loads the repo-root `.env` for local scripts. Docker Compose supplies the
 * same variables directly, so a missing file is not an error.
 */
export function loadEnvironment(): void {
  const envFile = path.resolve(__dirname, '../../../../.env');

  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

export function databaseUrl(): string {
  loadEnvironment();

  return process.env.DATABASE_URL ?? 'postgres://courtly:courtly@localhost:5433/courtly';
}
