import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../backend/app.js';
import { openDatabase } from '../backend/database.js';
import { createProductController } from '../backend/controllers/products.js';

const productData = { name: 'Café especial', description: 'Pacote de 250 g', price: 24.9, barcode: '7891234567890' };
const supplierData = { name: 'Distribuidora Horizonte', cnpj: '12.345.678/0001-95', address: 'Rua das Flores, 120, São Paulo - SP', contact: 'contato@horizonte.example' };

async function fixture(t) {
  const database = openDatabase(':memory:');
  const server = createApp({ database });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    database.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(path, method = 'GET', body) {
    const response = await fetch(`${base}/api${path}`, { method, ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    const data = response.status === 204 ? null : await response.json();
    return { status: response.status, headers: response.headers, data };
  }
  return { call, base, database };
}

test('saúde da aplicação e listas vazias', async (t) => {
  const { call } = await fixture(t);
  assert.deepEqual((await call('/health')).data, { status: 'ok' });
  for (const path of ['/products', '/suppliers', '/associations']) {
    const result = await call(path);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, []);
  }
});

test('CRUD de produto, pesquisa e preço armazenado em centavos', async (t) => {
  const { call, database } = await fixture(t);
  const created = await call('/products', 'POST', productData);
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.equal(created.headers.get('location'), `/api/products/${id}`);
  assert.equal(created.data.price, 24.9);
  assert.equal(database.prepare('SELECT price_cents FROM products WHERE id = ?').get(id).price_cents, 2490);
  assert.equal((await call(`/products/${id}`)).data.name, productData.name);
  assert.equal((await call('/products?q=Caf')).data.length, 1);
  assert.equal((await call('/products?q=inexistente')).data.length, 0);
  const updated = await call(`/products/${id}`, 'PUT', { ...productData, name: 'Café torrado', price: 30.01 });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.name, 'Café torrado');
  assert.equal(updated.data.price, 30.01);
  assert.equal((await call(`/products/${id}`, 'DELETE')).status, 204);
  assert.equal((await call(`/products/${id}`)).status, 404);
});

test('CRUD de fornecedor e normalização de CNPJ', async (t) => {
  const { call } = await fixture(t);
  const created = await call('/suppliers', 'POST', supplierData);
  assert.equal(created.status, 201);
  assert.equal(created.data.cnpj, '12345678000195');
  const id = created.data.id;
  assert.equal((await call(`/suppliers/${id}`)).data.name, supplierData.name);
  assert.equal((await call('/suppliers?q=Horizonte')).data.length, 1);
  const updated = await call(`/suppliers/${id}`, 'PUT', { ...supplierData, contact: '(11) 99999-1111' });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.contact, '(11) 99999-1111');
  assert.equal((await call(`/suppliers/${id}`, 'DELETE')).status, 204);
  assert.equal((await call(`/suppliers/${id}`)).status, 404);
});

test('código de barras, CNPJ e pares produto/fornecedor não podem se repetir', async (t) => {
  const { call } = await fixture(t);
  const product = (await call('/products', 'POST', productData)).data;
  const supplier = (await call('/suppliers', 'POST', supplierData)).data;
  assert.equal((await call('/products', 'POST', productData)).status, 409);
  assert.equal((await call('/suppliers', 'POST', { ...supplierData, cnpj: '12345678000195' })).status, 409);
  const body = { productId: product.id, supplierId: supplier.id };
  assert.equal((await call('/associations', 'POST', body)).status, 201);
  assert.equal((await call('/associations', 'POST', body)).status, 409);
});

test('relações muitos para muitos, filtros e consultas nas duas direções', async (t) => {
  const { call } = await fixture(t);
  const firstProduct = (await call('/products', 'POST', productData)).data;
  const secondProduct = (await call('/products', 'POST', { ...productData, name: 'Chá verde', barcode: '7891234567891' })).data;
  const firstSupplier = (await call('/suppliers', 'POST', supplierData)).data;
  const secondSupplier = (await call('/suppliers', 'POST', { ...supplierData, name: 'Casa do Café', cnpj: '98765432000198' })).data;
  for (const [productId, supplierId] of [[firstProduct.id, firstSupplier.id], [firstProduct.id, secondSupplier.id], [secondProduct.id, firstSupplier.id]]) {
    assert.equal((await call('/associations', 'POST', { productId, supplierId })).status, 201);
  }
  assert.equal((await call('/associations')).data.length, 3);
  assert.equal((await call(`/products/${firstProduct.id}/suppliers`)).data.length, 2);
  assert.equal((await call(`/suppliers/${firstSupplier.id}/products`)).data.length, 2);
  assert.equal((await call(`/products/${firstProduct.id}`)).data.supplierCount, 2);
  assert.equal((await call(`/suppliers/${firstSupplier.id}`)).data.productCount, 2);
  assert.equal((await call(`/associations?productId=${firstProduct.id}`)).data.length, 2);
  assert.equal((await call(`/associations?productId=${firstProduct.id}&supplierId=${firstSupplier.id}`)).data.length, 1);
});

test('desvincular preserva os cadastros originais', async (t) => {
  const { call } = await fixture(t);
  const product = (await call('/products', 'POST', productData)).data;
  const supplier = (await call('/suppliers', 'POST', supplierData)).data;
  const association = (await call('/associations', 'POST', { productId: product.id, supplierId: supplier.id })).data;
  assert.equal((await call(`/associations/${association.id}`)).data.productName, productData.name);
  assert.equal((await call(`/associations/${association.id}`, 'DELETE')).status, 204);
  assert.equal((await call(`/products/${product.id}`)).status, 200);
  assert.equal((await call(`/suppliers/${supplier.id}`)).status, 200);
  assert.deepEqual((await call('/associations')).data, []);
});

test('exclusão de produto ou fornecedor remove vínculos sem deixar registros órfãos', async (t) => {
  const { call } = await fixture(t);
  const product = (await call('/products', 'POST', productData)).data;
  const supplier = (await call('/suppliers', 'POST', supplierData)).data;
  await call('/associations', 'POST', { productId: product.id, supplierId: supplier.id });
  await call(`/products/${product.id}`, 'DELETE');
  assert.deepEqual((await call('/associations')).data, []);
  assert.equal((await call(`/suppliers/${supplier.id}`)).data.productCount, 0);
  const nextProduct = (await call('/products', 'POST', productData)).data;
  await call('/associations', 'POST', { productId: nextProduct.id, supplierId: supplier.id });
  await call(`/suppliers/${supplier.id}`, 'DELETE');
  assert.deepEqual((await call('/associations')).data, []);
  assert.equal((await call(`/products/${nextProduct.id}`)).data.supplierCount, 0);
});

test('validação de campos, preços, CNPJ e identificadores', async (t) => {
  const { call } = await fixture(t);
  for (const invalid of [{ ...productData, name: ' ' }, { ...productData, price: -1 }, { ...productData, price: '10' }, { ...productData, price: 10.001 }, { ...productData, barcode: '' }]) {
    const result = await call('/products', 'POST', invalid);
    assert.equal(result.status, 400);
    assert.ok(result.data.fields);
  }
  for (const cnpj of ['123', 'abcdefghijklmn', '12.345.678/0001-aa']) {
    assert.equal((await call('/suppliers', 'POST', { ...supplierData, cnpj })).status, 400);
  }
  for (const id of ['abc', '0', '-1', '1.5', '9007199254740992']) assert.equal((await call(`/products/${id}`)).status, 400);
  assert.equal((await call('/associations', 'POST', { productId: true, supplierId: 1 })).status, 400);
  assert.equal((await call('/associations?productId=abc')).status, 400);
});

test('associações rejeitam cadastros inexistentes e rotas desconhecidas', async (t) => {
  const { call } = await fixture(t);
  assert.equal((await call('/associations', 'POST', { productId: 999, supplierId: 999 })).status, 404);
  assert.equal((await call('/products/999/suppliers')).status, 404);
  assert.equal((await call('/suppliers/999/products')).status, 404);
  assert.equal((await call('/unknown')).status, 404);
  assert.equal((await call('/products/999', 'DELETE')).status, 404);
});

test('JSON inválido, tipo de conteúdo e métodos HTTP são tratados', async (t) => {
  const { call, base } = await fixture(t);
  const invalidJson = await fetch(`${base}/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid' });
  assert.equal(invalidJson.status, 400);
  const wrongType = await fetch(`${base}/api/products`, { method: 'POST', body: JSON.stringify(productData) });
  assert.equal(wrongType.status, 415);
  assert.equal((await call('/products', 'DELETE')).status, 405);
  assert.equal((await call('/products/1', 'PATCH', productData)).status, 405);
  assert.equal((await call('/associations/1', 'PUT', {})).status, 405);
  assert.equal((await call('/products', 'POST', [])).status, 400);
  assert.equal((await call('/products', 'POST', { ...productData, description: 'x'.repeat(70000) })).status, 413);
});

test('pesquisa usa parâmetros e não executa SQL fornecido pelo usuário', async (t) => {
  const { call } = await fixture(t);
  await call('/products', 'POST', productData);
  const result = await call(`/products?q=${encodeURIComponent("'; DROP TABLE products; --")}`);
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, []);
  assert.equal((await call('/products')).data.length, 1);
});

test('dados persistem após fechar e reabrir o arquivo SQLite', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'elo-persistence-'));
  const filename = join(directory, 'database.sqlite');
  t.after(() => {
    for (const suffix of ['', '-wal', '-shm']) if (existsSync(`${filename}${suffix}`)) unlinkSync(`${filename}${suffix}`);
    rmdirSync(directory);
  });
  let database = openDatabase(filename);
  const product = createProductController(database).create(productData);
  database.close();
  database = openDatabase(filename);
  try {
    const stored = createProductController(database).get(product.id);
    assert.equal(stored.name, productData.name);
    assert.equal(stored.price, productData.price);
  } finally {
    database.close();
  }
});
