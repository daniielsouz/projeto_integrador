import { test, expect } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  for (const resource of ['products', 'suppliers']) {
    const response = await request.get(`/api/${resource}`);
    for (const item of await response.json()) await request.delete(`/api/${resource}/${item.id}`);
  }
});

test('cadastro, edição, busca, vínculo, consulta e exclusão pelas três páginas', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Produtos.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Novo produto', exact: true }).click();
  await page.getByLabel('Nome do produto').fill('Café especial');
  await page.getByRole('textbox', { name: 'Descrição', exact: true }).fill('Pacote de 250 g');
  await page.getByLabel('Preço (R$)').fill('24.90');
  await page.getByRole('textbox', { name: 'Código de barras', exact: true }).fill('7891234567890');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(page.getByRole('table').getByText('Café especial', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar Café especial', exact: true }).click();
  await page.getByLabel('Preço (R$)').fill('29.90');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(page.getByRole('cell', { name: /R\$\s*29,90/ })).toBeVisible();
  await page.getByRole('searchbox').fill('inexistente');
  await expect(page.getByRole('heading', { name: 'Nenhum resultado encontrado' })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).first().click();

  await page.getByRole('navigation').getByRole('link', { name: /Fornecedores/ }).click();
  await page.getByRole('button', { name: 'Novo fornecedor', exact: true }).click();
  await page.getByLabel('Nome do fornecedor').fill('Distribuidora Horizonte');
  await page.getByRole('textbox', { name: 'CNPJ', exact: true }).fill('12.345.678/0001-95');
  await page.getByRole('textbox', { name: 'Endereço', exact: true }).fill('Rua das Flores, 120, São Paulo - SP');
  await page.getByRole('textbox', { name: 'Contato', exact: true }).fill('contato@horizonte.example');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(page.getByRole('table').getByText('Distribuidora Horizonte', { exact: true })).toBeVisible();

  await page.getByRole('navigation').getByRole('link', { name: /Associações/ }).click();
  await page.getByRole('button', { name: 'Nova associação', exact: true }).click();
  await page.getByRole('combobox', { name: 'Produto', exact: true }).selectOption({ label: 'Café especial · 7891234567890' });
  await page.getByRole('combobox', { name: 'Fornecedor', exact: true }).selectOption({ label: 'Distribuidora Horizonte · 12.345.678/0001-95' });
  await page.getByRole('dialog').getByRole('button', { name: 'Criar associação', exact: true }).click();
  await expect(page.getByRole('table').getByText('Café especial', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').getByText('Distribuidora Horizonte', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('table').getByText('Café especial', { exact: true })).toBeVisible();

  await page.getByRole('navigation').getByRole('link', { name: /Produtos/ }).click();
  await page.getByRole('button', { name: '1 fornecedor', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Distribuidora Horizonte')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('navigation').getByRole('link', { name: /Fornecedores/ }).click();
  await page.getByRole('button', { name: '1 produto', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Café especial')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();

  await page.getByRole('navigation').getByRole('link', { name: /Associações/ }).click();
  await page.getByRole('button', { name: 'Desvincular Café especial de Distribuidora Horizonte', exact: true }).click();
  await page.getByRole('button', { name: 'Desvincular', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'As conexões começam aqui' })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: /Produtos/ }).click();
  await page.getByRole('button', { name: 'Excluir Café especial', exact: true }).click();
  await page.getByRole('button', { name: 'Excluir cadastro', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Seu primeiro produto começa aqui' })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: /Fornecedores/ }).click();
  await page.getByRole('button', { name: 'Excluir Distribuidora Horizonte', exact: true }).click();
  await page.getByRole('button', { name: 'Excluir cadastro', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Seu primeiro fornecedor começa aqui' })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test('conflito de cadastro é exibido sem fechar o formulário', async ({ page, request }) => {
  await request.post('/api/products', { data: { name: 'Café cadastrado', description: '250 g', price: 10, barcode: '7891234567890' } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Novo produto', exact: true }).click();
  await page.getByLabel('Nome do produto').fill('Outro café');
  await page.getByRole('textbox', { name: 'Descrição', exact: true }).fill('500 g');
  await page.getByLabel('Preço (R$)').fill('20');
  await page.getByRole('textbox', { name: 'Código de barras', exact: true }).fill('7891234567890');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(page.getByRole('alert')).toHaveText('Já existe um produto com esse código de barras.');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Nome do produto')).toHaveValue('Outro café');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('menu e formulários funcionam em tela pequena sem transbordamento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('navigation').getByRole('link', { name: /Fornecedores/ }).click();
  await expect(page.getByRole('heading', { name: 'Fornecedores.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Novo fornecedor', exact: true }).click();
  await expect(page.getByLabel('Nome do fornecedor')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar cadastro' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});
