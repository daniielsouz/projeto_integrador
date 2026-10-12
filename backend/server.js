import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { createApp } from './app.js';
import { openDatabase } from './database.js';

if (existsSync('.env')) loadEnvFile('.env');

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT deve ser um número entre 1 e 65535.');

const database = openDatabase(process.env.DATABASE_PATH ?? './data/projeto.sqlite');
const server = createApp({ database });
server.listen(port, host, () => console.log(`Servidor disponível em http://${host}:${port}`));
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `A porta ${port} já está em uso. Altere PORT no arquivo .env.` : error.message);
  database.close();
  process.exitCode = 1;
});

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    database.close();
    process.exit(0);
  });
  server.closeIdleConnections();
  setTimeout(() => server.closeAllConnections(), 2000).unref();
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
