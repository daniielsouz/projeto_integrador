import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

if (existsSync('.env')) loadEnvFile('.env');

const backend = spawn(process.execPath, ['--watch', 'backend/server.js'], { stdio: 'inherit' });
let frontend;
let closing = false;
async function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  backend.kill();
  await frontend?.close();
  process.exit(code);
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
backend.on('exit', (code) => { if (!closing) shutdown(code ?? 1); });
backend.on('error', (error) => { console.error(error.message); shutdown(1); });

try {
  frontend = await createServer({ configFile: fileURLToPath(new URL('../frontend/vite.config.js', import.meta.url)) });
  await frontend.listen();
  frontend.printUrls();
} catch (error) {
  console.error(error.message);
  await shutdown(1);
}
