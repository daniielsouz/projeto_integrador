# FACULDADE GRAN

Projeto Disciplina Projeto Integrador

## Elo — Produtos e fornecedores

Sistema para cadastrar produtos, gerenciar fornecedores e consultar as associações entre eles. O frontend utiliza React e consome uma API em Node.js. Os dados são persistidos em SQLite.

## Funcionalidades

- Cadastro, consulta, edição e exclusão de produtos.
- Cadastro, consulta, edição e exclusão de fornecedores.
- Associação e desassociação de produtos e fornecedores.
- Consulta de fornecedores de um produto e de produtos de um fornecedor.
- Busca, filtros, ordenação, paginação e resumo dos cadastros.
- Validação dos campos e prevenção de códigos de barras, CNPJs e associações duplicados.
- Interface em português, adaptada para computador e celular.

## Requisitos

- Node.js 24 ou superior, com npm.
- Git para versionamento.
- VS Code para edição do projeto.
- Insomnia ou Postman para testes manuais da API.

## Executar no Windows

Abra o terminal do VS Code na pasta do projeto e execute:

```powershell
npm.cmd ci
npm.cmd run dev
```

Acesse **http://127.0.0.1:5173** no navegador. A API fica disponível em **http://127.0.0.1:3000/api**.

O comando `npm.cmd` permite executar o npm no PowerShell mesmo quando a política do Windows bloqueia arquivos `.ps1`. Em outros terminais, use `npm` no lugar de `npm.cmd`.

Para carregar cadastros de demonstração, execute em outro terminal:

```powershell
npm.cmd run seed
```

Esse comando adiciona 8 produtos, 4 fornecedores e 10 associações. Os dados são fictícios. O comando pode ser repetido, preserva os cadastros existentes e não duplica os registros de demonstração. Atualize a lista na interface após executá-lo.

## Executar a versão compilada

```powershell
npm.cmd run build
npm.cmd start
```

A interface e a API ficam disponíveis no mesmo servidor: **http://127.0.0.1:3000**. Para encerrar qualquer servidor, pressione `Ctrl+C` no terminal.

## Configuração

Na Netlify, `netlify.toml` publica a interface em `dist` e a função `netlify/functions/api.mjs` atende às rotas `/api/*`. O banco SQLite começa vazio e é salvo no armazenamento persistente Netlify Blobs. A aplicação local e a aplicação publicada usam bancos separados. Não é necessário cadastrar senhas ou tokens na interface para acessar a API.

O armazenamento usa consistência forte e gravações condicionais para preservar alterações simultâneas. Esta configuração é destinada ao volume de dados de um projeto acadêmico: cada alteração salva o arquivo SQLite completo. Os registros continuam disponíveis em novas execuções e publicações do mesmo projeto Netlify.

As configurações padrão são suficientes para execução local. Para alterá-las, copie `.env.example` para `.env`:

```powershell
Copy-Item .env.example .env
```

| Variável | Padrão | Finalidade |
| --- | --- | --- |
| `PORT` | `3000` | Porta da API e da versão compilada |
| `HOST` | `127.0.0.1` | Endereço de escuta do servidor |
| `DATABASE_PATH` | `./data/projeto.sqlite` | Caminho do arquivo SQLite |

O banco é criado na primeira inicialização. Os registros permanecem salvos ao encerrar e reiniciar o servidor. O arquivo do banco, as dependências e a versão compilada ficam fora do versionamento.

## Estrutura

```text
backend/
  controllers/
    products.js
    suppliers.js
    associations.js
  app.js
  database.js
  http.js
  server.js
frontend/
  public/
  src/
    App.jsx
    api.js
    main.jsx
    styles.css
  index.html
  vite.config.js
scripts/
  dev.mjs
  seed.mjs
tests/
  api.test.js
  e2e/
docs/
  API.md
  postman_collection.json
```

## API e testes manuais

As rotas e os exemplos estão em [docs/API.md](docs/API.md). A coleção [docs/postman_collection.json](docs/postman_collection.json) pode ser importada no Postman ou no Insomnia.

Na coleção, execute primeiro as requisições de criação de produto e fornecedor. No Postman, seus identificadores são armazenados automaticamente. No Insomnia, ajuste `product_id`, `supplier_id` e `association_id` com os identificadores retornados, caso a importação não execute os scripts de resposta.

## Testes automatizados

Para verificar a API e a persistência no SQLite:

```powershell
npm.cmd test
```

Para verificar a interface pelo navegador:

```powershell
npm.cmd run build
npm.cmd run test:e2e
```

No Windows, os testes usam o Microsoft Edge instalado. Para usar o Google Chrome:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm.cmd run test:e2e
```

Em outros sistemas, instale o Chromium do Playwright com `npx playwright install chromium`. Os testes da interface iniciam seu próprio servidor na porta 3001 e usam um banco em memória, separado dos cadastros locais.

## Versionamento e GitHub

Se a pasta ainda não for um repositório:

```powershell
git init -b main
```

Configure seu nome e e-mail no Git, se necessário:

```powershell
git config user.name "SEU NOME"
git config user.email "SEU EMAIL"
```

Registre o projeto:

```powershell
git add .
git commit -m "Implementa cadastro de produtos e fornecedores"
```

Crie um repositório vazio no GitHub, copie a URL dele e substitua `URL_DO_REPOSITORIO`:

```powershell
git remote add origin URL_DO_REPOSITORIO
git push -u origin main
```

O envio exige autenticação na sua conta do GitHub.

## Decisões de implementação

O frontend usa React com Vite, seguindo a orientação atual do React para projetos iniciados com uma ferramenta de compilação. O Create React App citado no material de apoio foi descontinuado: [documentação do React](https://react.dev/blog/2025/02/14/sunsetting-create-react-app).

O backend usa o servidor HTTP e o módulo SQLite do Node.js. Os controladores são separados por recurso, as consultas usam parâmetros, e os preços são armazenados em centavos. A tabela de associações representa uma relação muitos para muitos e remove os vínculos quando um dos cadastros relacionados é excluído.

O CNPJ aceita 14 dígitos com ou sem pontuação. A validação verifica formato e unicidade; não consulta a Receita Federal nem valida os dígitos verificadores.
