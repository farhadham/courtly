import { migrateDatabase } from './migrate';

migrateDatabase()
  .then(() => {
    console.log('Migrations applied.');
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
