# API de produtos e fornecedores

Endereço padrão: `http://127.0.0.1:3000/api`.

As respostas são JSON. Requisições `POST` e `PUT` devem enviar o cabeçalho `Content-Type: application/json`. O tamanho máximo do corpo é 64 KB.

## Produtos

| Método | Rota | Operação |
| --- | --- | --- |
| GET | `/products` | Listar produtos |
| GET | `/products?q=cafe` | Buscar por nome, descrição ou código de barras |
| GET | `/products/:id` | Consultar um produto |
| POST | `/products` | Cadastrar um produto |
| PUT | `/products/:id` | Atualizar todos os campos de um produto |
| DELETE | `/products/:id` | Excluir um produto e suas associações |
| GET | `/products/:id/suppliers` | Consultar os fornecedores de um produto |

Corpo de criação e atualização:

```json
{
  "name": "Café especial",
  "description": "Pacote de 250 g",
  "price": 24.9,
  "barcode": "7891234567890"
}
```

Todos os campos são obrigatórios. O nome aceita até 120 caracteres, a descrição até 2000 e o código de barras até 64. O preço deve ser um número de 0 a 9.999.999,99, com até duas casas decimais. O código de barras é único.

As respostas incluem `id`, `createdAt`, `updatedAt` e `supplierCount`.

## Fornecedores

| Método | Rota | Operação |
| --- | --- | --- |
| GET | `/suppliers` | Listar fornecedores |
| GET | `/suppliers?q=horizonte` | Buscar por nome, CNPJ ou contato |
| GET | `/suppliers/:id` | Consultar um fornecedor |
| POST | `/suppliers` | Cadastrar um fornecedor |
| PUT | `/suppliers/:id` | Atualizar todos os campos de um fornecedor |
| DELETE | `/suppliers/:id` | Excluir um fornecedor e suas associações |
| GET | `/suppliers/:id/products` | Consultar os produtos de um fornecedor |

Corpo de criação e atualização:

```json
{
  "name": "Distribuidora Horizonte",
  "cnpj": "12.345.678/0001-95",
  "address": "Rua das Flores, 120, São Paulo - SP",
  "contact": "contato@horizonte.example"
}
```

Todos os campos são obrigatórios. O nome aceita até 120 caracteres, o endereço até 300 e o contato até 160. O CNPJ aceita 14 dígitos, com ou sem pontuação, e é armazenado sem pontuação. O CNPJ é único. O contato pode ser um telefone ou e-mail.

As respostas incluem `id`, `createdAt`, `updatedAt` e `productCount`.

## Associações

| Método | Rota | Operação |
| --- | --- | --- |
| GET | `/associations` | Listar associações |
| GET | `/associations/:id` | Consultar uma associação |
| GET | `/associations?productId=1` | Filtrar por produto |
| GET | `/associations?supplierId=1` | Filtrar por fornecedor |
| GET | `/associations?productId=1&supplierId=1` | Filtrar por ambos |
| POST | `/associations` | Associar produto e fornecedor |
| DELETE | `/associations/:id` | Desvincular produto e fornecedor |

Corpo de criação:

```json
{
  "productId": 1,
  "supplierId": 1
}
```

Os identificadores devem referenciar cadastros existentes. Cada par produto/fornecedor pode ter apenas uma associação. Desvincular uma associação preserva os produtos e os fornecedores.

As respostas incluem `id`, `productId`, `supplierId`, `createdAt`, `productName`, `productBarcode`, `productPrice`, `supplierName`, `supplierCnpj` e `supplierContact`.

## Saúde do servidor

`GET /health` responde com:

```json
{
  "status": "ok"
}
```

## Códigos de resposta

| Código | Significado |
| --- | --- |
| 200 | Consulta ou atualização concluída |
| 201 | Cadastro ou associação criado; cabeçalho `Location` informa a rota do registro |
| 204 | Exclusão concluída, sem corpo de resposta |
| 400 | JSON, campos ou identificadores inválidos |
| 404 | Cadastro ou rota não encontrado |
| 405 | Método HTTP não permitido; cabeçalho `Allow` informa os métodos aceitos |
| 409 | Código de barras, CNPJ ou associação duplicado |
| 413 | Corpo maior que 64 KB |
| 415 | Tipo de conteúdo diferente de JSON |
| 500 | Falha interna do servidor |

Exemplo de erro de validação:

```json
{
  "error": "Confira os campos informados.",
  "fields": {
    "name": "Este campo é obrigatório."
  }
}
```

Exemplo de conflito:

```json
{
  "error": "Já existe um produto com esse código de barras."
}
```
