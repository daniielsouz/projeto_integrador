import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { openDatabase } from '../backend/database.js';
import { createProductController } from '../backend/controllers/products.js';
import { createSupplierController } from '../backend/controllers/suppliers.js';
import { createAssociationController } from '../backend/controllers/associations.js';

if (existsSync('.env')) loadEnvFile('.env');

const database = openDatabase(process.env.DATABASE_PATH ?? './data/projeto.sqlite');
const products = createProductController(database);
const suppliers = createSupplierController(database);
const associations = createAssociationController(database, products, suppliers);
const sampleProducts = [
  { name: 'Café especial', description: 'Grãos selecionados · 250 g', price: 24.9, barcode: '7891000100011' },
  { name: 'Azeite extravirgem', description: 'Prensado a frio · 500 ml', price: 49.9, barcode: '7891000100028' },
  { name: 'Mel silvestre', description: 'Puro e natural · 300 g', price: 22.5, barcode: '7891000100035' },
  { name: 'Chá verde', description: 'Folhas selecionadas · 100 g', price: 18.9, barcode: '7891000100042' },
  { name: 'Granola artesanal', description: 'Castanhas e frutas · 400 g', price: 28.0, barcode: '7891000100059' },
  { name: 'Chocolate 70%', description: 'Cacau intenso · 80 g', price: 14.9, barcode: '7891000100066' },
  { name: 'Pasta de amendoim', description: 'Integral, sem açúcar · 500 g', price: 26.5, barcode: '7891000100073' },
  { name: 'Aveia em flocos', description: 'Flocos integrais · 500 g', price: 9.9, barcode: '7891000100080' },
];
const sampleSuppliers = [
  { name: 'Distribuidora Horizonte', cnpj: '12345678000195', address: 'Rua das Flores, 120 · São Paulo, SP', contact: 'contato@horizonte.example' },
  { name: 'Casa do Café', cnpj: '98765432000198', address: 'Av. Central, 350 · Campinas, SP', contact: '(19) 99999-1010' },
  { name: 'Raízes Naturais', cnpj: '11222333000181', address: 'Rua do Bosque, 45 · Curitiba, PR', contact: 'vendas@raizes.example' },
  { name: 'Armazém da Serra', cnpj: '44555666000120', address: 'Av. das Araucárias, 780 · Belo Horizonte, MG', contact: '(31) 99999-2020' },
];

try {
  database.exec('BEGIN');
  const productIds = sampleProducts.map((value) => database.prepare('SELECT id FROM products WHERE barcode = ?').get(value.barcode)?.id ?? products.create(value).id);
  const supplierIds = sampleSuppliers.map((value) => database.prepare('SELECT id FROM suppliers WHERE cnpj = ?').get(value.cnpj)?.id ?? suppliers.create(value).id);
  const links = [[0, 0], [0, 1], [1, 0], [1, 3], [2, 2], [3, 2], [4, 0], [4, 2], [5, 3], [6, 2]];
  for (const [productIndex, supplierIndex] of links) {
    const productId = productIds[productIndex];
    const supplierId = supplierIds[supplierIndex];
    if (!database.prepare('SELECT id FROM associations WHERE product_id = ? AND supplier_id = ?').get(productId, supplierId)) {
      associations.create({ productId, supplierId });
    }
  }
  database.exec('COMMIT');
  console.log('Dados de demonstração disponíveis: 8 produtos, 4 fornecedores e 10 associações.');
} catch (error) {
  database.exec('ROLLBACK');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  database.close();
}
