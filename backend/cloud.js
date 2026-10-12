import { mkdtemp, readFile, writeFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { createRequestHandler } from './app.js';
import { openDatabase } from './database.js';

async function executeRequest(request, body, database) {
  const url = new URL(request.url);
  const incoming = Readable.from(body.length ? [Buffer.from(body)] : []);
  incoming.method = request.method;
  incoming.url = `${url.pathname}${url.search}`;
  incoming.headers = Object.fromEntries(request.headers);

  let status = 200;
  const headers = new Headers();
  const chunks = [];
  const response = {
    headersSent: false,
    setHeader(name, value) {
      headers.set(name, String(value));
    },
    writeHead(code, values = {}) {
      status = code;
      for (const [name, value] of Object.entries(values)) headers.set(name, String(value));
      this.headersSent = true;
    },
    end(value) {
      if (value !== undefined && value !== null) chunks.push(Buffer.from(value));
      this.headersSent = true;
    },
  };

  await createRequestHandler({ database })(incoming, response);
  return new Response([204, 304].includes(status) ? null : Buffer.concat(chunks), { status, headers });
}

export function createCloudHandler(store) {
  return async (request) => {
    try {
      const body = new Uint8Array(await request.arrayBuffer());
      if (body.length > 65536) {
        return Response.json({ error: 'O corpo da requisição excede o limite de 64 KB.' }, { status: 413 });
      }

      for (let attempt = 0; attempt < 5; attempt++) {
        const snapshot = await store.getWithMetadata('database.sqlite', { type: 'arrayBuffer' });
        const directory = await mkdtemp(join(tmpdir(), 'elo-sqlite-'));
        const filename = join(directory, 'database.sqlite');
        let database;

        try {
          if (snapshot) await writeFile(filename, Buffer.from(snapshot.data));
          database = openDatabase(filename);
          const response = await executeRequest(request, body, database);
          database.close();
          database = null;

          const changed = ['POST', 'PUT', 'DELETE'].includes(request.method);
          if (response.status >= 400 || (snapshot && !changed)) return response;

          const bytes = await readFile(filename);
          const saved = await store.set('database.sqlite', new Blob([bytes]), snapshot
            ? { onlyIfMatch: snapshot.etag }
            : { onlyIfNew: true });
          if (saved.modified) return response;
        } finally {
          if (database) database.close();
          for (const suffix of ['', '-wal', '-shm']) await rm(`${filename}${suffix}`, { force: true });
          await rmdir(directory);
        }
      }

      return Response.json({ error: 'Não foi possível salvar agora. Tente novamente.' }, {
        status: 503,
        headers: { 'Retry-After': '1' },
      });
    } catch (error) {
      console.error(error);
      return Response.json({ error: 'Não foi possível conectar ao banco. Tente novamente.' }, { status: 500 });
    }
  };
}
