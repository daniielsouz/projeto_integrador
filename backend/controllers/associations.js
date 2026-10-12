import { HttpError, readId } from '../http.js';
import { productSelect } from './products.js';
import { supplierSelect } from './suppliers.js';

const associationSelect = `
  SELECT a.id, a.product_id AS productId, a.supplier_id AS supplierId, a.created_at AS createdAt,
    p.name AS productName, p.barcode AS productBarcode, p.price_cents / 100.0 AS productPrice,
    s.name AS supplierName, s.cnpj AS supplierCnpj, s.contact AS supplierContact
  FROM associations a
  JOIN products p ON p.id = a.product_id
  JOIN suppliers s ON s.id = a.supplier_id
`;

export function createAssociationController(database, products, suppliers) {
  const get = (id) => {
    const association = database.prepare(`${associationSelect} WHERE a.id = ?`).get(id);
    if (!association) throw new HttpError(404, 'Associação não encontrada.');
    return association;
  };

  return {
    list(filters = {}) {
      const conditions = [];
      const parameters = [];
      if (filters.productId !== undefined) {
        conditions.push('a.product_id = ?');
        parameters.push(readId(filters.productId, 'productId'));
      }
      if (filters.supplierId !== undefined) {
        conditions.push('a.supplier_id = ?');
        parameters.push(readId(filters.supplierId, 'supplierId'));
      }
      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
      return database.prepare(`${associationSelect}${where} ORDER BY a.id DESC`).all(...parameters);
    },
    get,
    create(body) {
      const productId = readId(body.productId, 'productId');
      const supplierId = readId(body.supplierId, 'supplierId');
      products.get(productId);
      suppliers.get(supplierId);
      const result = database.prepare('INSERT INTO associations (product_id, supplier_id) VALUES (?, ?)').run(productId, supplierId);
      return get(Number(result.lastInsertRowid));
    },
    remove(id) {
      get(id);
      database.prepare('DELETE FROM associations WHERE id = ?').run(id);
    },
    suppliersForProduct(id) {
      products.get(id);
      return database.prepare(`${supplierSelect} JOIN associations a ON a.supplier_id = s.id WHERE a.product_id = ? ORDER BY s.name`).all(id);
    },
    productsForSupplier(id) {
      suppliers.get(id);
      return database.prepare(`${productSelect} JOIN associations a ON a.product_id = p.id WHERE a.supplier_id = ? ORDER BY p.name`).all(id);
    },
  };
}
