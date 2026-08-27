import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const server = createApp(config).listen(config.port, () => {
  console.log(
    JSON.stringify({
      level: 'INFO',
      message: 'API listening',
      port: config.port,
    }),
  );
});

function shutdown(signal: string): void {
  console.log(
    JSON.stringify({ level: 'INFO', message: 'Shutting down', signal }),
  );
  server.close((error) => {
    process.exitCode = error ? 1 : 0;
  });
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
