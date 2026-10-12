import { HttpError, validateFields } from '../http.js';

export const productSelect = `
  SELECT p.id, p.name, p.description, p.price_cents / 100.0 AS price, p.barcode,
    p.created_at AS createdAt, p.updated_at AS updatedAt,
    (SELECT COUNT(*) FROM associations a WHERE a.product_id = p.id) AS supplierCount
  FROM products p
`;

function validateProduct(body) {
  const values = validateFields(body, { name: { max: 120 }, description: { max: 2000 }, barcode: { max: 64 } });
  const price = body.price;
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 9999999.99) {
    throw new HttpError(400, 'Confira o preço informado.', { price: 'Informe um preço entre 0 e 9.999.999,99.' });
  }
  const cents = Math.round(price * 100);
  if (Math.abs(price * 100 - cents) > 0.00001) {
    throw new HttpError(400, 'Confira o preço informado.', { price: 'Use no máximo duas casas decimais.' });
  }
  return { ...values, priceCents: cents };
}

export function createProductController(database) {
  const get = (id) => {
    const product = database.prepare(`${productSelect} WHERE p.id = ?`).get(id);
    if (!product) throw new HttpError(404, 'Produto não encontrado.');
    return product;
  };

  return {
    list(search = '') {
      const query = `%${search}%`;
      return database.prepare(`${productSelect} WHERE p.name LIKE ? OR p.barcode LIKE ? OR p.description LIKE ? ORDER BY p.id DESC`).all(query, query, query);
    },
    get,
    create(body) {
      const value = validateProduct(body);
      const result = database.prepare('INSERT INTO products (name, description, price_cents, barcode) VALUES (?, ?, ?, ?)')
        .run(value.name, value.description, value.priceCents, value.barcode);
      return get(Number(result.lastInsertRowid));
    },
    update(id, body) {
      get(id);
      const value = validateProduct(body);
      database.prepare(`UPDATE products SET name = ?, description = ?, price_cents = ?, barcode = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`)
        .run(value.name, value.description, value.priceCents, value.barcode, id);
      return get(id);
    },
    remove(id) {
      get(id);
      database.prepare('DELETE FROM products WHERE id = ?').run(id);
    },
  };
}
