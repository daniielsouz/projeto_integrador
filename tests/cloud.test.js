import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudHandler } from '../backend/cloud.js';

function createStore() {
  let entry = null;
  let revision = 0;
  return {
    async getWithMetadata() {
      return entry ? { data: entry.data.slice(0), etag: entry.etag } : null;
    },
    async set(key, value, condition) {
      const data = await value.arrayBuffer();
      if (condition.onlyIfNew ? !!entry : entry?.etag !== condition.onlyIfMatch) return { modified: false };
      entry = { data, etag: String(++revision) };
      return { modified: true, etag: entry.etag };
    },
  };
}

function call(handler, path, method = 'GET', body) {
  return handler(new Request(`https://example.test/api${path}`, {
    method,
    ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  }));
}

const product = { name: 'Produto de teste', description: 'Descrição de teste', price: 12.34, barcode: 'cloud-001' };
const supplier = { name: 'Fornecedor de teste', cnpj: '12345678000195', address: 'Endereço de teste', contact: 'teste@example.test' };

test('banco na nuvem começa vazio e é preservado entre execuções', async () => {
  const store = createStore();
  let handler = createCloudHandler(store);
  for (const resource of ['/products', '/suppliers', '/associations']) {
    const response = await call(handler, resource);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
  }
  const created = await call(handler, '/products', 'POST', product);
  assert.equal(created.status, 201);
  handler = createCloudHandler(store);
  const products = await (await call(handler, '/products')).json();
  assert.equal(products.length, 1);
  assert.equal(products[0].price, 12.34);
});

test('CRUD e associações persistem e a exclusão mantém integridade', async () => {
  const handler = createCloudHandler(createStore());
  const p = await (await call(handler, '/products', 'POST', product)).json();
  const s = await (await call(handler, '/suppliers', 'POST', supplier)).json();
  const association = await call(handler, '/associations', 'POST', { productId: p.id, supplierId: s.id });
  assert.equal(association.status, 201);
  assert.equal((await (await call(handler, `/products/${p.id}/suppliers`)).json()).length, 1);
  assert.equal((await (await call(handler, `/suppliers/${s.id}/products`)).json()).length, 1);
  const updated = await call(handler, `/products/${p.id}`, 'PUT', { ...product, price: 25.5 });
  assert.equal(updated.status, 200);
  assert.equal((await (await call(handler, `/products/${p.id}`)).json()).price, 25.5);
  const deleted = await call(handler, `/suppliers/${s.id}`, 'DELETE');
  assert.equal(deleted.status, 204);
  assert.equal(await deleted.text(), '');
  assert.deepEqual(await (await call(handler, '/associations')).json(), []);
});

test('gravações simultâneas não sobrescrevem cadastros', async () => {
  const store = createStore();
  const handlers = Array.from({ length: 3 }, () => createCloudHandler(store));
  const responses = await Promise.all(handlers.map((handler, index) => call(handler, '/products', 'POST', {
    ...product, name: `Produto ${index}`, barcode: `concurrent-${index}`,
  })));
  assert.ok(responses.every((response) => response.status === 201));
  const products = await (await call(createCloudHandler(store), '/products')).json();
  assert.equal(products.length, 3);
  assert.equal(new Set(products.map((value) => value.id)).size, 3);
});

test('erros de validação e duplicidade não modificam o banco', async () => {
  const handler = createCloudHandler(createStore());
  assert.equal((await call(handler, '/products', 'POST', { ...product, price: -1 })).status, 400);
  assert.deepEqual(await (await call(handler, '/products')).json(), []);
  await call(handler, '/products', 'POST', product);
  assert.equal((await call(handler, '/products', 'POST', product)).status, 409);
  assert.equal((await (await call(handler, '/products')).json()).length, 1);
  assert.equal((await call(handler, '/products', 'DELETE')).status, 405);
  assert.equal((await call(handler, '/products', 'POST', { ...product, description: 'x'.repeat(70000) })).status, 413);
});

test('conflito persistente de gravação retorna erro em vez de confirmar dados não salvos', async () => {
  const store = createStore();
  const handler = createCloudHandler(store);
  await call(handler, '/products');
  store.set = async () => ({ modified: false });
  const response = await call(handler, '/products', 'POST', product);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '1');
  assert.deepEqual(await (await call(handler, '/products')).json(), []);
});
