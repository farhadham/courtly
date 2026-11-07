import { createServer } from 'node:http';
import { createApp } from './app';
import { jwtSecret } from './config';
import { createDatabase } from './db/client';
import { databaseUrl } from './db/config';

const port = Number(process.env.PORT ?? 3001);
const { db, pool } = createDatabase(databaseUrl());
const server = createServer(createApp({ db, jwtSecret: jwtSecret() }));

server.listen(port, '0.0.0.0', () => {
  console.log(`Courtly API listening on http://0.0.0.0:${port}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received; closing the HTTP server.`);

  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }

    void pool.end();
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
