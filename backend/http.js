export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export function sendJson(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(data));
}

export async function readJson(request) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Envie os dados no formato application/json.');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 65536) throw new HttpError(413, 'O corpo da requisição excede o limite de 64 KB.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('invalid-object');
    }
    return value;
  } catch {
    throw new HttpError(400, 'Envie um objeto JSON válido.');
  }
}

export function readId(value, field = 'id') {
  const id = typeof value === 'number' ? value : Number(value);
  if (!['number', 'string'].includes(typeof value) || !Number.isSafeInteger(id) || id <= 0 || (typeof value === 'string' && !/^\d+$/.test(value))) {
    throw new HttpError(400, 'Informe um identificador válido.', { [field]: 'Use um número inteiro positivo.' });
  }
  return id;
}

export function methodNotAllowed(response, allowed) {
  response.setHeader('Allow', allowed.join(', '));
  throw new HttpError(405, 'Método não permitido nesta rota.');
}

export function validateFields(body, specifications) {
  const values = {};
  const fields = {};
  for (const [key, specification] of Object.entries(specifications)) {
    const value = typeof body[key] === 'string' ? body[key].trim() : '';
    if (!value) fields[key] = 'Este campo é obrigatório.';
    else if (value.length > specification.max) fields[key] = `Use até ${specification.max} caracteres.`;
    else values[key] = value;
  }
  if (Object.keys(fields).length) throw new HttpError(400, 'Confira os campos informados.', fields);
  return values;
}

export function handleError(response, error) {
  if (response.headersSent) {
    response.end();
    return;
  }
  if (error instanceof HttpError) {
    sendJson(response, error.status, { error: error.message, ...(error.fields && { fields: error.fields }) });
    return;
  }
  if (error.code === 'ERR_SQLITE_ERROR' && /UNIQUE constraint failed/.test(error.message)) {
    const message = error.message.includes('products.barcode')
      ? 'Já existe um produto com esse código de barras.'
      : error.message.includes('suppliers.cnpj')
        ? 'Já existe um fornecedor com esse CNPJ.'
        : 'Este produto já está associado a esse fornecedor.';
    sendJson(response, 409, { error: message });
    return;
  }
  console.error(error);
  sendJson(response, 500, { error: 'Não foi possível concluir a operação. Tente novamente.' });
}
