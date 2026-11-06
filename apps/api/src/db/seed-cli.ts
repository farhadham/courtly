import { seedDatabase } from './seed';

seedDatabase()
  .then(() => {
    console.log('Seed complete.');
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
