# Controle Financeiro — Projeto 2 (Full Stack)

Aplicação de controle financeiro pessoal: API REST em Node.js/Express com PostgreSQL e SPA em React.

## Tecnologias
- **Back-end:** Node.js 24 (mínimo 22), Express 5, `pg` (pool de conexões), `bcrypt`, `jsonwebtoken`, `dotenv`, `cors`, `express-rate-limit`. Testes com `node:test`.
- **Front-end:** React, React Router, Vite, Recharts. HTTP com `fetch`; CSS puro.
- **Banco:** PostgreSQL 16 (via Docker).

## Como rodar do zero
Pré-requisitos: Node 24 (mínimo 22) e Docker.

```bash
# 1. Banco de dados (sobe o Postgres; cria também o banco de testes financas_test)
docker compose up -d

# 2. Back-end
cd backend
npm install
cp .env.example .env          # ajuste JWT_SECRET
npm run db:schema             # cria as tabelas
npm run db:seed               # 2 usuários de demonstração + 3 meses de lançamentos
npm run dev                   # http://localhost:3000

# 3. Front-end (outro terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Usuários do seed (senha `Senha1234`): `ana@exemplo.com` e `bruno@exemplo.com`.

### Testes
```bash
cd backend
npm run db:schema:test        # uma vez: cria as tabelas do banco de testes
npm test
```
Os testes de integração usam o banco `financas_test`; o banco de desenvolvimento não é tocado.

## Variáveis de ambiente (`backend/.env`)
`PORT`, `DATABASE_URL`, `DATABASE_URL_TEST`, `JWT_SECRET`, `JWT_EXPIRA` (padrão `1h`), `CORS_ORIGIN` (padrão `http://localhost:5173`). O `.env` não é versionado; use o `.env.example` como modelo.

## Estrutura
```
backend/src/server.js
backend/src/routes/       rotas + controladores
backend/src/models/       acesso ao banco e utilitários puros
backend/src/middlewares/  autenticação, validação, erros, rate limit
backend/src/config/       env, pool do banco, JWT
backend/database/         schema.sql, seed.js
frontend/src/components/  páginas e componentes
frontend/src/contexts/    AuthContext
frontend/src/services/    api.js (único ponto de acesso à API)
```
**Utilitários puros** (`cpf.js`, `dinheiro.js`, `datas.js`, `calculoFatura.js`) ficam em `backend/src/models/`, conforme permitido pelo enunciado.

## Rotas da API
Todas sob `/api`; exceto cadastro e login, exigem `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/cadastro` | Cadastra usuário (201, 400, 409) |
| POST | `/auth/login` | Devolve o JWT (200, 400, 401) |
| GET | `/auth/me` | Usuário logado |
| GET, POST | `/categorias` | Lista / cria |
| PUT, DELETE | `/categorias/:id` | Edita / exclui (409 se houver lançamentos) |
| GET, POST | `/fontes-destinos` | Lista / cria |
| PUT, DELETE | `/fontes-destinos/:id` | Edita / exclui |
| GET | `/lancamentos?inicio=&fim=&tipo=&categoriaId=&fonteDestinoId=&pagina=&limite=` | Lista com filtros, paginação e totais (padrão: mês corrente) |
| POST | `/lancamentos` | Cria (com parcelas, se houver) |
| GET, PUT, DELETE | `/lancamentos/:id` | Detalha / edita / exclui (`?todasParcelas=true`) |
| GET | `/relatorios/categorias?inicio=&fim=` | RF7 |
| GET | `/relatorios/fontes-destinos?inicio=&fim=` | RF8 |
| GET | `/relatorios/faturas?meses=3` | RF9 |
| GET | `/saude-financeira` | Desafio |

Erros seguem sempre `{ "erro": "...", "campos": { "campo": "mensagem" } }`.

## Decisões de projeto
- **Parcelas:** cada parcela é um lançamento; todas guardam a **data da compra** e a fatura é calculada por `calcularFatura(data, cartao, parcela_atual)`. Assim a regra de fechamento fica em um só lugar e pode ser corrigida sem migrar dados.
- **Dinheiro:** `NUMERIC(12,2)` no banco; divisão de parcelas em centavos (a sobra vai para a primeira parcela).
- **Unicidade:** e-mail e CPF têm `UNIQUE` no banco; o cadastro trata o erro `23505` e responde 409 indicando o campo. O e-mail é gravado em minúsculas e o CPF só com dígitos.
- **Isolamento:** toda consulta filtra por `usuario_id` do token; recurso de outro usuário responde 404.
- **Edição de parcela:** altera apenas aquela parcela; parcelas não trocam de tipo nem de cartão.
- **Categorias padrão:** Salário e Outros (entrada); Alimentação, Moradia, Saúde, Mobilidade, Lazer, Educação e Outros (saída); fonte padrão "Conta corrente".

## Desafio: saúde financeira
`GET /api/saude-financeira` calcula tudo no back-end. Limites usados pelas dicas (`LIMITES` em `backend/src/models/saudeFinanceira.js`):

| Regra | Limite |
|---|---|
| Taxa de poupança abaixo de | 10% da renda |
| Comprometimento com faturas acima de | 50% da renda média |
| Categoria fora da curva | 30% acima da média dos 3 meses anteriores |
| Reserva de emergência abaixo de | 3 meses de despesas |

A projeção de 6 meses usa a média das entradas e das saídas fora do cartão dos 3 meses anteriores. O saldo inicial é entradas − saídas fora do cartão (até hoje) − faturas de cartão já vencidas ou que vencem no mês corrente; a projeção de cada mês seguinte soma a média das entradas, subtrai a média das saídas fora do cartão e subtrai as faturas (incluindo parcelas futuras) que vencem naquele mês. As dicas são geradas por regras; não há API de IA. A página exibe aviso de que o conteúdo é educativo.
