import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductController } from './controllers/products.js';
import { createSupplierController } from './controllers/suppliers.js';
import { createAssociationController } from './controllers/associations.js';
import { HttpError, handleError, methodNotAllowed, readId, readJson, sendJson } from './http.js';

const defaultStaticDirectory = fileURLToPath(new URL('../dist/', import.meta.url));
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
};

async function serveStatic(request, response, pathname, staticDirectory) {
  if (!['GET', 'HEAD'].includes(request.method)) methodNotAllowed(response, ['GET', 'HEAD']);
  const directory = resolve(staticDirectory);
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, 'Endereço inválido.');
  }
  const filename = resolve(directory, `.${decoded === '/' ? '/index.html' : decoded}`);
  if (!filename.startsWith(`${directory}${sep}`)) throw new HttpError(403, 'Acesso não permitido.');
  let body;
  let servedFile = filename;
  try {
    body = await readFile(filename);
  } catch (error) {
    if (!['ENOENT', 'EISDIR'].includes(error.code)) throw error;
    if (extname(filename)) throw new HttpError(404, 'Arquivo não encontrado.');
    servedFile = resolve(directory, 'index.html');
    try {
      body = await readFile(servedFile);
    } catch {
      throw new HttpError(404, 'Interface indisponível. Execute npm run build ou use npm run dev.');
    }
  }
  response.writeHead(200, {
    'Content-Type': contentTypes[extname(servedFile)] ?? 'application/octet-stream',
    'Cache-Control': extname(servedFile) === '.html' ? 'no-cache' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

export function createApp({ database, staticDirectory = defaultStaticDirectory }) {
  const products = createProductController(database);
  const suppliers = createSupplierController(database);
  const associations = createAssociationController(database, products, suppliers);

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const pathname = url.pathname.replace(/\/$/, '') || '/';
      if (pathname === '/api/health') {
        if (request.method !== 'GET') methodNotAllowed(response, ['GET']);
        database.prepare('SELECT 1').get();
        sendJson(response, 200, { status: 'ok' });
        return;
      }

      const related = pathname.match(/^\/api\/(products|suppliers)\/([^/]+)\/(products|suppliers)$/);
      if (related) {
        if (request.method !== 'GET') methodNotAllowed(response, ['GET']);
        const id = readId(related[2]);
        if (related[1] === 'products' && related[3] === 'suppliers') {
          sendJson(response, 200, associations.suppliersForProduct(id));
        } else if (related[1] === 'suppliers' && related[3] === 'products') {
          sendJson(response, 200, associations.productsForSupplier(id));
        } else throw new HttpError(404, 'Rota não encontrada.');
        return;
      }

      const route = pathname.match(/^\/api\/(products|suppliers|associations)(?:\/([^/]+))?$/);
      if (route) {
        const resource = route[1];
        const controller = { products, suppliers, associations }[resource];
        const id = route[2] === undefined ? null : readId(route[2]);
        if (request.method === 'GET') {
          const filters = resource === 'associations'
            ? Object.fromEntries(['productId', 'supplierId'].filter((key) => url.searchParams.has(key)).map((key) => [key, url.searchParams.get(key)]))
            : url.searchParams.get('q') ?? '';
          sendJson(response, 200, id === null ? controller.list(filters) : controller.get(id));
        } else if (request.method === 'POST' && id === null) {
          const value = controller.create(await readJson(request));
          response.setHeader('Location', `/api/${resource}/${value.id}`);
          sendJson(response, 201, value);
        } else if (request.method === 'PUT' && id !== null && resource !== 'associations') {
          sendJson(response, 200, controller.update(id, await readJson(request)));
        } else if (request.method === 'DELETE' && id !== null) {
          controller.remove(id);
          response.writeHead(204);
          response.end();
        } else {
          methodNotAllowed(response, id === null ? ['GET', 'POST'] : resource === 'associations' ? ['GET', 'DELETE'] : ['GET', 'PUT', 'DELETE']);
        }
        return;
      }

      if (pathname === '/api' || pathname.startsWith('/api/')) throw new HttpError(404, 'Rota não encontrada.');
      await serveStatic(request, response, url.pathname, staticDirectory);
    } catch (error) {
      handleError(response, error);
    }
  });
}
