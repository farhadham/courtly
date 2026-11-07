import { createServer } from 'node:http';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3001);
const server = createServer(createApp());

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
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
