import { HttpError, validateFields } from '../http.js';

export const supplierSelect = `
  SELECT s.id, s.name, s.cnpj, s.address, s.contact,
    s.created_at AS createdAt, s.updated_at AS updatedAt,
    (SELECT COUNT(*) FROM associations a WHERE a.supplier_id = s.id) AS productCount
  FROM suppliers s
`;

function validateSupplier(body) {
  const values = validateFields(body, { name: { max: 120 }, cnpj: { max: 18 }, address: { max: 300 }, contact: { max: 160 } });
  if (!/^(\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/.test(values.cnpj)) {
    throw new HttpError(400, 'Confira o CNPJ informado.', { cnpj: 'Informe os 14 dígitos do CNPJ, com ou sem pontuação.' });
  }
  return { ...values, cnpj: values.cnpj.replace(/\D/g, '') };
}

export function createSupplierController(database) {
  const get = (id) => {
    const supplier = database.prepare(`${supplierSelect} WHERE s.id = ?`).get(id);
    if (!supplier) throw new HttpError(404, 'Fornecedor não encontrado.');
    return supplier;
  };

  return {
    list(search = '') {
      const query = `%${search}%`;
      return database.prepare(`${supplierSelect} WHERE s.name LIKE ? OR s.cnpj LIKE ? OR s.contact LIKE ? ORDER BY s.id DESC`).all(query, query, query);
    },
    get,
    create(body) {
      const value = validateSupplier(body);
      const result = database.prepare('INSERT INTO suppliers (name, cnpj, address, contact) VALUES (?, ?, ?, ?)')
        .run(value.name, value.cnpj, value.address, value.contact);
      return get(Number(result.lastInsertRowid));
    },
    update(id, body) {
      get(id);
      const value = validateSupplier(body);
      database.prepare(`UPDATE suppliers SET name = ?, cnpj = ?, address = ?, contact = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`)
        .run(value.name, value.cnpj, value.address, value.contact, id);
      return get(id);
    },
    remove(id) {
      get(id);
      database.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    },
  };
}
