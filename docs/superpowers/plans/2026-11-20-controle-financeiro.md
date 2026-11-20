# Controle Financeiro Full Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a aplicação de controle financeiro do Projeto 2 (API Express + PostgreSQL + SPA React) conforme o PDF do enunciado.

**Architecture:** Monorepo com `backend/` (Express 5, `pg.Pool`, rotas com controladores embutidos, models com SQL parametrizado, utilitários puros em `models/`) e `frontend/` (Vite + React Router + Context API, cliente HTTP único). Regras de negócio e validação no servidor; front só complementa. Postgres via Docker.

**Tech Stack:** Node 24, express, pg, bcrypt, jsonwebtoken, dotenv, cors, express-rate-limit, `node:test`; React, react-router-dom, vite, recharts.

**Spec:** `docs/superpowers/specs/2026-11-20-controle-financeiro-design.md` (e o PDF `Projeto2-Controle-Financeiro.pdf`, que prevalece em conflito).

## Global Constraints

- Somente estas bibliotecas (outras precisam de aprovação do professor): back `express`, `pg`, `bcrypt`, `jsonwebtoken`, `dotenv`, `cors`, `express-rate-limit`; front `react`, `react-dom`, `react-router-dom`, `vite`, `@vitejs/plugin-react`, `recharts`. HTTP com `fetch`, CSS puro, testes com `node:test`, validação escrita à mão.
- `backend/src/` contém apenas `server.js` e as pastas `routes/`, `models/`, `middlewares/`, `config/`. Sem pasta `controllers`.
- Acesso ao banco só em `models/` (e nos scripts de `backend/database/`). Controladores dentro dos arquivos de rotas.
- Todas as consultas parametrizadas; nunca concatenar valor do usuário em SQL.
- Dinheiro: `NUMERIC(12,2)` no banco; cálculos em centavos inteiros no JS.
- Erros sempre no formato `{ "erro": "...", "campos": { campo: "msg" } }`.
- Toda consulta filtra por `usuario_id = req.usuarioId` (vindo do token). Recurso de outro usuário → 404.
- `senha_hash` nunca aparece em resposta. E-mail gravado com `trim().toLowerCase()`; CPF só com dígitos.
- JWT de 1h (`sub` = id). CORS restrito a `CORS_ORIGIN` (`http://localhost:5173`). Rate limit no login.
- JSON da API em camelCase (`categoriaId`, `fonteDestinoId`, `diaFechamento`...).
- Textos de UI, rotas e mensagens em português. Valores em BRL com `Intl.NumberFormat('pt-BR')`, datas dd/mm/aaaa.
- `.env` fora do Git; `.env.example` versionado.
- **Commits:** nunca commitar sem o usuário pedir. O último passo de cada tarefa é um "checkpoint de commit": pergunte ao usuário; se autorizado, rode o comando e termine a mensagem com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Entradas que o spec implica mas que as tarefas poderiam esquecer (cada uma tem teste na tarefa dona):

1. Corpo da requisição ausente ou JSON malformado em POST/PUT → 400 no padrão de erro, nunca 500 (Task 3).
2. `:id` não numérico (`/lancamentos/abc`) ou gigante → 404, nunca 500 (Task 5).
3. Valor inválido: `0`, negativo, `"10,5"`, `1.005` (3 casas), texto → 400 com mensagem no campo `valor` (Task 6).
4. Data impossível (`2026-02-30`), período invertido (`inicio > fim`), `pagina=0` ou `pagina=abc` → 400 (Tasks 2, 6, 8).
5. Relatório de período sem dados: total 0 e percentual 0, sem `NaN` nem divisão por zero (Tasks 8, 11).

## Mapa de arquivos

```
docker-compose.yml  .gitignore  README.md
backend/
  package.json  .env.example
  database/  schema.sql  init-teste.sql  aplicar-schema.js  seed.js
  src/server.js
  src/config/       env.js  db.js  jwt.js
  src/middlewares/  erros.js  autenticar.js  limitadorLogin.js  validar.js
                    validarAuth.js  validarCadastros.js  validarLancamento.js
  src/models/       cpf.js  dinheiro.js  datas.js  calculoFatura.js        (puros)
                    usuario.js  categoria.js  fonteDestino.js  lancamento.js
                    relatorio.js  fatura.js  saudeFinanceira.js
  src/routes/       auth.routes.js  categorias.routes.js  fontes-destinos.routes.js
                    lancamentos.routes.js  relatorios.routes.js  saude-financeira.routes.js
  test/             helpers.js  *.test.js
frontend/
  package.json  vite.config.js  index.html
  src/main.jsx  App.jsx  styles.css
  src/services/api.js
  src/contexts/AuthContext.jsx
  src/utils/        formatar.js  mascaras.js  cpf.js  useCarregar.js
  src/components/   layout/  comuns/  paginas/
```

---

### Task 1: Repositório, Docker, schema e configuração do back-end

**Files:**
- Create: `.gitignore`, `docker-compose.yml`, `backend/package.json`, `backend/.env.example`, `backend/.env` (local, não versionado), `backend/database/schema.sql`, `backend/database/init-teste.sql`, `backend/database/aplicar-schema.js`, `backend/src/config/env.js`, `backend/src/config/db.js`, `backend/src/config/jwt.js`

**Interfaces:**
- Produces: `env` (`{porta, databaseUrl, jwtSecret, jwtExpira, corsOrigin, teste}`) de `config/env.js`; `pool`, `consultar(sql, params)`, `transacao(async (client) => ...)` de `config/db.js`; `assinar(usuarioId): string`, `verificar(token): payload` de `config/jwt.js`. O pool devolve `NUMERIC` como `Number` e `DATE` como string `AAAA-MM-DD`.

- [ ] **Step 1: Inicializar git e arquivos de raiz**

```bash
git init
```

`.gitignore`:
```
node_modules/
dist/
.env
*.log
```

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: financas-db
    environment:
      POSTGRES_USER: financas
      POSTGRES_PASSWORD: financas
      POSTGRES_DB: financas
    ports:
      - "5432:5432"
    volumes:
      - financas-dados:/var/lib/postgresql/data
      - ./backend/database/init-teste.sql:/docker-entrypoint-initdb.d/init-teste.sql:ro
volumes:
  financas-dados:
```

`backend/database/init-teste.sql`:
```sql
CREATE DATABASE financas_test;
```

- [ ] **Step 2: package.json e dependências**

`backend/package.json`:
```json
{
  "name": "financas-backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js",
    "db:schema": "node database/aplicar-schema.js",
    "db:schema:test": "node database/aplicar-schema.js --teste",
    "db:seed": "node database/seed.js",
    "test": "node --test --test-concurrency=1 \"test/**/*.test.js\""
  }
}
```

Run: `cd backend && npm install express pg bcrypt jsonwebtoken dotenv cors express-rate-limit`
Expected: instalação sem erro. Se o `bcrypt` falhar ao compilar no Windows, pare e avise o usuário (não troque por outra lib sem aprovação).

- [ ] **Step 3: Variáveis de ambiente**

`backend/.env.example`:
```
PORT=3000
DATABASE_URL=postgresql://financas:financas@localhost:5432/financas
DATABASE_URL_TEST=postgresql://financas:financas@localhost:5432/financas_test
JWT_SECRET=troque-por-um-segredo-longo-e-aleatorio
JWT_EXPIRA=1h
CORS_ORIGIN=http://localhost:5173
```
Run: `cp backend/.env.example backend/.env`

- [ ] **Step 4: schema.sql** (DDL do PDF + `reserva` + CHECK de parcela)

`backend/database/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS usuarios (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(120) NOT NULL,
  email      VARCHAR(160) NOT NULL UNIQUE,
  cpf        CHAR(11)     NOT NULL UNIQUE,
  senha_hash VARCHAR(100) NOT NULL,
  criado_em  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categorias (
  id         SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome       VARCHAR(60) NOT NULL,
  tipo       VARCHAR(7)  NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  UNIQUE (usuario_id, nome, tipo)
);

CREATE TABLE IF NOT EXISTS fontes_destinos (
  id             SERIAL PRIMARY KEY,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome           VARCHAR(60) NOT NULL,
  tipo           VARCHAR(14) NOT NULL CHECK (tipo IN ('renda', 'conta', 'cartao_credito')),
  dia_fechamento SMALLINT CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento SMALLINT CHECK (dia_vencimento BETWEEN 1 AND 31),
  limite         NUMERIC(12, 2),
  reserva        BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (usuario_id, nome),
  CHECK (tipo <> 'cartao_credito'
         OR (dia_fechamento IS NOT NULL AND dia_vencimento IS NOT NULL AND limite IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS lancamentos (
  id                 SERIAL PRIMARY KEY,
  usuario_id         INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo               VARCHAR(7)   NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  descricao          VARCHAR(120) NOT NULL,
  valor              NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  data               DATE NOT NULL,
  categoria_id       INTEGER NOT NULL REFERENCES categorias(id),
  fonte_destino_id   INTEGER NOT NULL REFERENCES fontes_destinos(id),
  parcela_atual      SMALLINT NOT NULL DEFAULT 1,
  total_parcelas     SMALLINT NOT NULL DEFAULT 1 CHECK (total_parcelas BETWEEN 1 AND 48),
  grupo_parcelamento UUID,
  criado_em          TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (parcela_atual BETWEEN 1 AND total_parcelas)
);

CREATE INDEX IF NOT EXISTS idx_lancamentos_usuario_data ON lancamentos (usuario_id, data);
```

- [ ] **Step 5: Script que aplica o schema**

`backend/database/aplicar-schema.js`:
```js
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const teste = process.argv.includes('--teste');
const url = teste ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
if (!url) {
  console.error('Defina DATABASE_URL (e DATABASE_URL_TEST) no .env');
  process.exit(1);
}

const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
const cliente = new pg.Client({ connectionString: url });
await cliente.connect();
try {
  await cliente.query(sql);
  console.log(`Schema aplicado em ${teste ? 'financas_test' : 'financas'}.`);
} finally {
  await cliente.end();
}
```

- [ ] **Step 6: config/env.js, db.js, jwt.js**

`backend/src/config/env.js`:
```js
import 'dotenv/config';

const teste = process.env.NODE_ENV === 'test';

export const env = {
  porta: Number(process.env.PORT ?? 3000),
  databaseUrl: teste ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpira: process.env.JWT_EXPIRA ?? '1h',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  teste,
};

if (!env.databaseUrl || !env.jwtSecret) {
  throw new Error('Variáveis de ambiente ausentes: configure DATABASE_URL e JWT_SECRET no .env');
}
```

`backend/src/config/db.js`:
```js
import pg from 'pg';
import { env } from './env.js';

pg.types.setTypeParser(1700, (v) => Number(v)); // NUMERIC -> number
pg.types.setTypeParser(1082, (v) => v);         // DATE -> 'AAAA-MM-DD' (sem fuso)

export const pool = new pg.Pool({ connectionString: env.databaseUrl, max: 10 });

export const consultar = (sql, params) => pool.query(sql, params);

export async function transacao(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}
```

`backend/src/config/jwt.js`:
```js
import jwt from 'jsonwebtoken';
import { env } from './env.js';

export const assinar = (usuarioId) =>
  jwt.sign({}, env.jwtSecret, { subject: String(usuarioId), expiresIn: env.jwtExpira });

export const verificar = (token) => jwt.verify(token, env.jwtSecret);
```

- [ ] **Step 7: Subir o banco e aplicar o schema**

Run:
```bash
docker compose up -d
cd backend && npm run db:schema && npm run db:schema:test
```
Expected: `Schema aplicado em financas.` e `Schema aplicado em financas_test.` (se a conexão for recusada, aguarde alguns segundos o Postgres iniciar e repita).

- [ ] **Step 8: Verificar as tabelas**

Run: `docker exec financas-db psql -U financas -d financas -c "\dt"`
Expected: lista `usuarios`, `categorias`, `fontes_destinos`, `lancamentos`.

- [ ] **Step 9: Checkpoint de commit**

```bash
git add .gitignore docker-compose.yml backend/package.json backend/package-lock.json backend/.env.example backend/database backend/src/config
git commit -m "chore: estrutura inicial, docker, schema e config do backend"
```

---

### Task 2: Utilitários puros (CPF, dinheiro, datas, fatura) com testes

**Files:**
- Create: `backend/src/models/cpf.js`, `backend/src/models/dinheiro.js`, `backend/src/models/datas.js`, `backend/src/models/calculoFatura.js`
- Test: `backend/test/cpf.test.js`, `backend/test/dinheiro.test.js`, `backend/test/datas.test.js`, `backend/test/calculoFatura.test.js`

**Interfaces:**
- Produces:
  - `cpfValido(cpf): boolean`
  - `paraCentavos(v): number`, `deCentavos(c): number`, `arredondar(n): number`, `somarValores(arr): number`, `percentual(parte, total): number`, `dividirParcelas(valor, n): number[]`
  - `dataValida(s): boolean`, `somarDias(iso, n)`, `diasEntre(a, b)`, `hojeISO()`, `mesCorrente(iso?) → {inicio, fim}`, `periodoAnterior(inicio, fim) → {inicio, fim}`, `somarMeses('AAAA-MM', n) → 'AAAA-MM'`
  - `calcularFatura(dataCompra, {diaFechamento, diaVencimento}, numeroParcela = 1) → {referencia, fechamento, vencimento}`; `listarFaturas(dataBase, cartao, quantidade) → [{referencia, fechamento, vencimento}]` (a primeira é a fatura aberta)

- [ ] **Step 1: Testes do CPF**

`backend/test/cpf.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpfValido } from '../src/models/cpf.js';

test('aceita CPF válido com e sem pontuação', () => {
  assert.equal(cpfValido('529.982.247-25'), true);
  assert.equal(cpfValido('52998224725'), true);
});

test('rejeita dígito verificador errado, sequências repetidas e tamanho errado', () => {
  assert.equal(cpfValido('529.982.247-24'), false);
  assert.equal(cpfValido('111.111.111-11'), false);
  assert.equal(cpfValido('123'), false);
  assert.equal(cpfValido(''), false);
  assert.equal(cpfValido(undefined), false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && node --test test/cpf.test.js`
Expected: FAIL (módulo `cpf.js` não existe).

- [ ] **Step 3: Implementar o CPF**

`backend/src/models/cpf.js`:
```js
// Valida os dois dígitos verificadores do CPF
export function cpfValido(cpf) {
  const d = String(cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && node --test test/cpf.test.js`
Expected: PASS (2 testes).

- [ ] **Step 5: Testes de dinheiro**

`backend/test/dinheiro.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { dividirParcelas, somarValores, percentual, arredondar } from '../src/models/dinheiro.js';

test('R$ 100,00 em 3x: sobra de centavos vai para a primeira parcela', () => {
  assert.deepEqual(dividirParcelas(100, 3), [33.34, 33.33, 33.33]);
});

test('parcelas somam exatamente o total', () => {
  for (const [valor, n] of [[100, 3], [0.1, 3], [999.99, 7], [1234.56, 48], [50, 1]]) {
    assert.equal(somarValores(dividirParcelas(valor, n)), valor);
  }
});

test('somarValores evita erro de ponto flutuante', () => {
  assert.equal(somarValores([0.1, 0.2]), 0.3);
});

test('percentual trata total zero sem NaN', () => {
  assert.equal(percentual(0, 0), 0);
  assert.equal(percentual(1500, 3250), 46.15);
  assert.equal(arredondar(2.005 + 0.0000001), 2.01);
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `cd backend && node --test test/dinheiro.test.js`
Expected: FAIL (módulo não existe).

- [ ] **Step 7: Implementar dinheiro.js**

`backend/src/models/dinheiro.js`:
```js
export const paraCentavos = (v) => Math.round(Number(v) * 100);
export const deCentavos = (c) => c / 100;
export const arredondar = (n) => Math.round(Number(n) * 100) / 100;

export const somarValores = (valores) =>
  deCentavos(valores.reduce((soma, v) => soma + paraCentavos(v), 0));

export const percentual = (parte, total) =>
  total === 0 ? 0 : Math.round((parte / total) * 10000) / 100;

// Divide em centavos; a diferença de arredondamento vai para a primeira parcela.
export function dividirParcelas(valor, n) {
  const total = paraCentavos(valor);
  const base = Math.floor(total / n);
  const resto = total - base * n;
  return Array.from({ length: n }, (_, i) => deCentavos(i === 0 ? base + resto : base));
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `cd backend && node --test test/dinheiro.test.js`
Expected: PASS (4 testes).

- [ ] **Step 9: Testes de datas**

`backend/test/datas.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { dataValida, mesCorrente, periodoAnterior, somarMeses, somarDias } from '../src/models/datas.js';

test('dataValida rejeita datas impossíveis e formatos errados', () => {
  assert.equal(dataValida('2026-02-28'), true);
  assert.equal(dataValida('2026-02-30'), false);
  assert.equal(dataValida('2026-13-01'), false);
  assert.equal(dataValida('28/02/2026'), false);
  assert.equal(dataValida(undefined), false);
  assert.equal(dataValida(20260228), false);
});

test('mesCorrente devolve primeiro e último dia', () => {
  assert.deepEqual(mesCorrente('2026-02-10'), { inicio: '2026-02-01', fim: '2026-02-28' });
  assert.deepEqual(mesCorrente('2028-02-10'), { inicio: '2028-02-01', fim: '2028-02-29' });
});

test('periodoAnterior: mês inteiro vira o mês anterior', () => {
  assert.deepEqual(periodoAnterior('2026-10-01', '2026-10-31'), { inicio: '2026-09-01', fim: '2026-09-30' });
  assert.deepEqual(periodoAnterior('2026-01-01', '2026-01-31'), { inicio: '2025-12-01', fim: '2025-12-31' });
});

test('periodoAnterior: intervalo livre tem o mesmo tamanho', () => {
  assert.deepEqual(periodoAnterior('2026-10-10', '2026-10-19'), { inicio: '2026-09-30', fim: '2026-10-09' });
});

test('somarMeses e somarDias atravessam virada de ano', () => {
  assert.equal(somarMeses('2026-11', 3), '2027-02');
  assert.equal(somarMeses('2026-01', -1), '2025-12');
  assert.equal(somarDias('2026-12-31', 1), '2027-01-01');
});
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `cd backend && node --test test/datas.test.js`
Expected: FAIL (módulo não existe).

- [ ] **Step 11: Implementar datas.js**

`backend/src/models/datas.js`:
```js
const pad = (n) => String(n).padStart(2, '0');
const paraUTC = (s) => {
  const [a, m, d] = s.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const deUTC = (ms) => new Date(ms).toISOString().slice(0, 10);

export function dataValida(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export const somarDias = (s, n) => deUTC(paraUTC(s) + n * 86400000);
export const diasEntre = (a, b) => Math.round((paraUTC(b) - paraUTC(a)) / 86400000);

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Primeiro e último dia do mês da data informada (padrão: hoje)
export function mesCorrente(data = hojeISO()) {
  const [a, m] = data.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { inicio: `${a}-${pad(m)}-01`, fim: `${a}-${pad(m)}-${pad(ultimo)}` };
}

export function somarMeses(anoMes, n) {
  const [a, m] = anoMes.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

// Mês inteiro -> mês anterior inteiro; intervalo livre -> mesmo tamanho imediatamente antes.
export function periodoAnterior(inicio, fim) {
  const [a, m, d] = inicio.split('-').map(Number);
  if (d === 1 && fim === mesCorrente(inicio).fim) {
    return mesCorrente(`${somarMeses(`${a}-${pad(m)}`, -1)}-01`);
  }
  const dias = diasEntre(inicio, fim) + 1;
  const anteriorFim = somarDias(inicio, -1);
  return { inicio: somarDias(anteriorFim, -(dias - 1)), fim: anteriorFim };
}
```

- [ ] **Step 12: Rodar e ver passar**

Run: `cd backend && node --test test/datas.test.js`
Expected: PASS (5 testes).

- [ ] **Step 13: Testes da regra de fatura** (Tabela 10.3 do PDF + fevereiro)

`backend/test/calculoFatura.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularFatura, listarFaturas } from '../src/models/calculoFatura.js';

const nubank = { diaFechamento: 3, diaVencimento: 10 };
const visa = { diaFechamento: 25, diaVencimento: 5 };

test('Tabela 10.3: compra antes do fechamento', () => {
  assert.deepEqual(calcularFatura('2026-11-02', nubank), {
    referencia: '2026-11', fechamento: '2026-11-03', vencimento: '2026-11-10',
  });
});

test('Tabela 10.3: compra no dia do fechamento cai na fatura seguinte', () => {
  assert.deepEqual(calcularFatura('2026-11-03', nubank), {
    referencia: '2026-12', fechamento: '2026-12-03', vencimento: '2026-12-10',
  });
});

test('Tabela 10.3: vencimento menor que fechamento vai para o mês seguinte', () => {
  assert.deepEqual(calcularFatura('2026-12-28', visa), {
    referencia: '2027-02', fechamento: '2027-01-25', vencimento: '2027-02-05',
  });
});

test('Tabela 10.3: parcela 3 cai dois meses depois da primeira', () => {
  assert.deepEqual(calcularFatura('2026-12-20', visa, 3), {
    referencia: '2027-03', fechamento: '2027-02-25', vencimento: '2027-03-05',
  });
});

test('fechamento dia 31 em fevereiro ajusta para o último dia do mês', () => {
  const cartao = { diaFechamento: 31, diaVencimento: 10 };
  assert.deepEqual(calcularFatura('2027-02-15', cartao), {
    referencia: '2027-03', fechamento: '2027-02-28', vencimento: '2027-03-10',
  });
  assert.deepEqual(calcularFatura('2027-02-28', cartao), {
    referencia: '2027-04', fechamento: '2027-03-31', vencimento: '2027-04-10',
  });
});

test('listarFaturas começa na fatura aberta e segue mês a mês', () => {
  const refs = listarFaturas('2026-11-20', nubank, 4).map((f) => f.referencia);
  assert.deepEqual(refs, ['2026-12', '2027-01', '2027-02', '2027-03']);
});
```

- [ ] **Step 14: Rodar e ver falhar**

Run: `cd backend && node --test test/calculoFatura.test.js`
Expected: FAIL (módulo não existe).

- [ ] **Step 15: Implementar calculoFatura.js**

`backend/src/models/calculoFatura.js`:
```js
// Datas em UTC para evitar problemas de fuso horário.
function ultimoDiaDoMes(ano, mes) { // mes: 0 a 11
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
}

function dataSegura(ano, mes, dia) { // aceita mes > 11 e ajusta dia 31 em meses curtos
  const a = ano + Math.floor(mes / 12);
  const m = ((mes % 12) + 12) % 12;
  return new Date(Date.UTC(a, m, Math.min(dia, ultimoDiaDoMes(a, m))));
}

const iso = (d) => d.toISOString().slice(0, 10);

// Mês (índice, podendo passar de 11) em que fecha a fatura da parcela informada
function mesDeFechamento(dataCompra, cartao, numeroParcela) {
  const [ano, mes, dia] = dataCompra.split('-').map(Number);
  const m = mes - 1;
  const fechamentoDoMes = Math.min(cartao.diaFechamento, ultimoDiaDoMes(ano, m));
  const base = dia < fechamentoDoMes ? m : m + 1; // no dia do fechamento ou depois: mês seguinte
  return { ano, mes: base + numeroParcela - 1 };
}

function montarFatura(ano, mesFechamento, cartao) {
  const fechamento = dataSegura(ano, mesFechamento, cartao.diaFechamento);
  const mesVencimento = cartao.diaVencimento > cartao.diaFechamento ? mesFechamento : mesFechamento + 1;
  const vencimento = dataSegura(ano, mesVencimento, cartao.diaVencimento);
  return { referencia: iso(vencimento).slice(0, 7), fechamento: iso(fechamento), vencimento: iso(vencimento) };
}

// dataCompra: 'AAAA-MM-DD'; cartao: { diaFechamento, diaVencimento }
export function calcularFatura(dataCompra, cartao, numeroParcela = 1) {
  const { ano, mes } = mesDeFechamento(dataCompra, cartao, numeroParcela);
  return montarFatura(ano, mes, cartao);
}

// Faturas consecutivas a partir da fatura aberta na data informada
export function listarFaturas(dataBase, cartao, quantidade) {
  const { ano, mes } = mesDeFechamento(dataBase, cartao, 1);
  return Array.from({ length: quantidade }, (_, k) => montarFatura(ano, mes + k, cartao));
}
```

- [ ] **Step 16: Rodar toda a suíte**

Run: `cd backend && npm test`
Expected: PASS em todos os arquivos de teste.

- [ ] **Step 17: Checkpoint de commit**

```bash
git add backend/src/models backend/test
git commit -m "feat: utilitários puros de CPF, dinheiro, datas e fatura com testes"
```

---

### Task 3: Autenticação no back-end (cadastro, login, JWT, erros, server)

**Files:**
- Create: `backend/src/middlewares/erros.js`, `autenticar.js`, `limitadorLogin.js`, `validar.js`, `validarAuth.js`; `backend/src/models/usuario.js`, `categoria.js`, `fonteDestino.js`; `backend/src/routes/auth.routes.js`; `backend/src/server.js`
- Test: `backend/test/helpers.js`, `backend/test/auth.test.js`

**Interfaces:**
- Consumes: `env`, `pool`, `transacao`, `assinar`, `verificar`, `cpfValido`.
- Produces:
  - `erros.js`: `class ErroApi(status, mensagem, campos?)`, `naoEncontrado(msg?)`, `traduzirDuplicata(erro, msg)` (devolve `ErroApi` 409 se `erro.code === '23505'`, senão o próprio erro), `tratarErros`, `rotaNaoEncontrada`.
  - `validar.js`: `criarValidador((body, campos, req) => dados)` (middleware que preenche `req.dados` ou responde 400), `texto(v)`, `inteiroPositivo(v) → number|null`, `valorMonetario(v) → number|null`, `validarId` (para `router.param('id', validarId)`; id inválido → 404), `validarPeriodo` (preenche `req.periodo = {inicio, fim}`; padrão mês corrente; inválido → 400).
  - `autenticar.js`: `autenticar` (define `req.usuarioId: number`).
  - `usuario.js`: `criar({nome,email,cpf,senhaHash}, exec = pool) → {id,nome,email}`, `buscarPorEmail(email) → row|null` (com `senha_hash`), `buscarPorId(id) → {id,nome,email}|null`.
  - `categoria.js`/`fonteDestino.js`: por ora só `criarPadrao(usuarioId, exec = pool)` (expandidos na Task 5).
  - `server.js`: `export const app`; só escuta a porta quando executado diretamente.
  - `test/helpers.js`: `iniciar()`, `encerrar()`, `limparBanco()`, `requisitar(metodo, caminho, {token, corpo, bruto}) → {status, corpo}`, `gerarCpf(base9)`, `criarUsuario(nome?) → {id, token, email, cpf, senha}`, `pool`.

- [ ] **Step 1: Helpers de teste**

`backend/test/helpers.js`:
```js
// IMPORTANTE: este arquivo define NODE_ENV antes de carregar o app (usa banco financas_test).
// Nos testes, importe os helpers ANTES de qualquer módulo de src/ que leia o ambiente.
import http from 'node:http';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { app } = await import('../src/server.js');
const { pool } = await import('../src/config/db.js');

export { pool };

let servidor;
let base;

export const limparBanco = () => pool.query('TRUNCATE usuarios RESTART IDENTITY CASCADE');

export async function iniciar() {
  servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, resolve));
  base = `http://127.0.0.1:${servidor.address().port}/api`;
  await limparBanco();
}

export async function encerrar() {
  servidor.closeAllConnections();
  await new Promise((resolve) => servidor.close(resolve));
  await pool.end();
}

export async function requisitar(metodo, caminho, { token, corpo, bruto, headers = {} } = {}) {
  const cabecalhos = { ...headers };
  let body;
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  if (bruto !== undefined) {
    cabecalhos['Content-Type'] = 'application/json';
    body = bruto;
  } else if (corpo !== undefined) {
    cabecalhos['Content-Type'] = 'application/json';
    body = JSON.stringify(corpo);
  }
  const resposta = await fetch(base + caminho, { method: metodo, headers: cabecalhos, body });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null, headers: resposta.headers };
}

// Gera um CPF válido a partir de 9 dígitos
export function gerarCpf(base9) {
  const d = base9.split('').map(Number);
  const dv = (n) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += d[i] * (n + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  d.push(dv(9));
  d.push(dv(10));
  return d.join('');
}

let contador = 0;
export async function criarUsuario(nome = 'Teste') {
  contador += 1;
  const cpf = gerarCpf(String(100000000 + contador * 7919));
  const email = `u${contador}@teste.com`;
  const senha = 'Senha1234';
  const cadastro = await requisitar('POST', '/auth/cadastro', { corpo: { nome, email, cpf, senha } });
  assert.equal(cadastro.status, 201);
  const login = await requisitar('POST', '/auth/login', { corpo: { email, senha } });
  assert.equal(login.status, 200);
  return { id: cadastro.corpo.id, token: login.corpo.token, email, cpf, senha };
}
```

- [ ] **Step 2: Testes de autenticação (falham primeiro)**

`backend/test/auth.test.js`:
```js
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { iniciar, encerrar, requisitar, pool, gerarCpf, criarUsuario } from './helpers.js';

before(iniciar);
after(encerrar);

const cpfA = gerarCpf('529982247');
const cadastroValido = { nome: 'Ana', email: 'ana@email.com', cpf: cpfA, senha: 'Senha1234', confirmarSenha: 'Senha1234' };

test('cadastro válido: 201, sem senha_hash, cria categorias e fonte padrão', async () => {
  const r = await requisitar('POST', '/auth/cadastro', { corpo: cadastroValido });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.email, 'ana@email.com');
  assert.equal(JSON.stringify(r.corpo).includes('senha'), false);
  const cats = await pool.query('SELECT COUNT(*)::int AS n FROM categorias WHERE usuario_id = $1', [r.corpo.id]);
  const fontes = await pool.query('SELECT COUNT(*)::int AS n FROM fontes_destinos WHERE usuario_id = $1', [r.corpo.id]);
  assert.equal(cats.rows[0].n, 9);
  assert.equal(fontes.rows[0].n, 1);
});

test('senha é gravada como hash bcrypt', async () => {
  const { rows } = await pool.query("SELECT senha_hash FROM usuarios WHERE email = 'ana@email.com'");
  assert.match(rows[0].senha_hash, /^\$2[aby]\$/);
});

test('e-mail repetido com maiúsculas diferentes: 409 no campo email', async () => {
  const r = await requisitar('POST', '/auth/cadastro', {
    corpo: { ...cadastroValido, email: '  ANA@Email.com ', cpf: gerarCpf('111222333') },
  });
  assert.equal(r.status, 409);
  assert.ok(r.corpo.campos.email);
  assert.equal(r.corpo.campos.cpf, undefined);
});

test('CPF repetido com pontuação: 409 no campo cpf', async () => {
  const formatado = cpfA.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  const r = await requisitar('POST', '/auth/cadastro', {
    corpo: { ...cadastroValido, email: 'outra@email.com', cpf: formatado },
  });
  assert.equal(r.status, 409);
  assert.ok(r.corpo.campos.cpf);
});

test('corrida: dois cadastros simultâneos com o mesmo e-mail geram um 201 e um 409', async () => {
  const corpo = (cpf) => ({ nome: 'Corrida', email: 'corrida@email.com', cpf, senha: 'Senha1234' });
  const [a, b] = await Promise.all([
    requisitar('POST', '/auth/cadastro', { corpo: corpo(gerarCpf('222333444')) }),
    requisitar('POST', '/auth/cadastro', { corpo: corpo(gerarCpf('333444555')) }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
});

test('validações do cadastro: 400 com campos', async () => {
  const r = await requisitar('POST', '/auth/cadastro', {
    corpo: { nome: '', email: 'x', cpf: '52998224724', senha: 'abc', confirmarSenha: 'outra' },
  });
  assert.equal(r.status, 400);
  assert.equal(r.corpo.erro, 'Dados inválidos.');
  for (const campo of ['nome', 'email', 'cpf', 'senha', 'confirmarSenha']) assert.ok(r.corpo.campos[campo], campo);
});

test('senha só com letras ou só com números é rejeitada', async () => {
  for (const senha of ['somenteletras', '1234567890']) {
    const r = await requisitar('POST', '/auth/cadastro', { corpo: { ...cadastroValido, senha, confirmarSenha: senha } });
    assert.equal(r.status, 400);
    assert.ok(r.corpo.campos.senha);
  }
});

test('Review Focus 1: corpo ausente e JSON malformado dão 400, não 500', async () => {
  const semCorpo = await requisitar('POST', '/auth/cadastro');
  assert.equal(semCorpo.status, 400);
  assert.ok(semCorpo.corpo.campos);
  const malformado = await requisitar('POST', '/auth/login', { bruto: '{"email": ' });
  assert.equal(malformado.status, 400);
  assert.ok(malformado.corpo.erro);
});

test('login: sucesso devolve token e usuário; falhas têm mensagem genérica idêntica', async () => {
  const ok = await requisitar('POST', '/auth/login', { corpo: { email: 'ANA@email.com', senha: 'Senha1234' } });
  assert.equal(ok.status, 200);
  assert.ok(ok.corpo.token);
  assert.equal(ok.corpo.usuario.email, 'ana@email.com');
  assert.equal(JSON.stringify(ok.corpo).includes('senha'), false);

  const senhaErrada = await requisitar('POST', '/auth/login', { corpo: { email: 'ana@email.com', senha: 'Errada123' } });
  const emailInexistente = await requisitar('POST', '/auth/login', { corpo: { email: 'nao@existe.com', senha: 'Senha1234' } });
  assert.equal(senhaErrada.status, 401);
  assert.equal(emailInexistente.status, 401);
  assert.deepEqual(senhaErrada.corpo, emailInexistente.corpo);
  assert.equal(senhaErrada.corpo.erro, 'E-mail ou senha inválidos.');
});

test('login sem campos: 400', async () => {
  const r = await requisitar('POST', '/auth/login', { corpo: {} });
  assert.equal(r.status, 400);
  assert.ok(r.corpo.campos.email && r.corpo.campos.senha);
});

test('/auth/me: sem token 401, token inválido 401, expirado 401, válido 200', async () => {
  const u = await criarUsuario();
  assert.equal((await requisitar('GET', '/auth/me')).status, 401);
  assert.equal((await requisitar('GET', '/auth/me', { token: 'lixo' })).status, 401);
  const expirado = jwt.sign({}, process.env.JWT_SECRET, { subject: String(u.id), expiresIn: -10 });
  assert.equal((await requisitar('GET', '/auth/me', { token: expirado })).status, 401);
  const ok = await requisitar('GET', '/auth/me', { token: u.token });
  assert.equal(ok.status, 200);
  assert.equal(ok.corpo.id, u.id);
  assert.equal(JSON.stringify(ok.corpo).includes('senha'), false);
});

test('rota inexistente devolve 404 no padrão de erro', async () => {
  const r = await requisitar('GET', '/nao-existe');
  assert.equal(r.status, 404);
  assert.ok(r.corpo.erro);
});

test('CORS: origem estranha não é autorizada', async () => {
  const r = await requisitar('GET', '/auth/me', { headers: { Origin: 'http://evil.example' } });
  assert.notEqual(r.headers.get('access-control-allow-origin'), 'http://evil.example');
  const ok = await requisitar('GET', '/auth/me', { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && node --test test/auth.test.js`
Expected: FAIL (`src/server.js` não existe).

- [ ] **Step 4: middlewares/erros.js**

`backend/src/middlewares/erros.js`:
```js
export class ErroApi extends Error {
  constructor(status, mensagem, campos) {
    super(mensagem);
    this.status = status;
    this.campos = campos;
  }
}

export const naoEncontrado = (mensagem = 'Recurso não encontrado.') => new ErroApi(404, mensagem);

// Converte violação de UNIQUE (23505) em 409 amigável; outros erros passam adiante.
export function traduzirDuplicata(erro, mensagem) {
  return erro.code === '23505' ? new ErroApi(409, mensagem, { nome: mensagem }) : erro;
}

export function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: 'Rota não encontrada.' });
}

// eslint-disable-next-line no-unused-vars
export function tratarErros(erro, req, res, next) {
  if (erro instanceof ErroApi) {
    return res.status(erro.status).json({ erro: erro.message, ...(erro.campos && { campos: erro.campos }) });
  }
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido.' });
  }
  if (erro.code === '23505') return res.status(409).json({ erro: 'Registro duplicado.' });
  if (erro.code === '23503') return res.status(409).json({ erro: 'Registro em uso por outros dados.' });
  if (erro.status && erro.status < 500) return res.status(erro.status).json({ erro: 'Requisição inválida.' });
  console.error(erro);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}
```

- [ ] **Step 5: middlewares/autenticar.js e limitadorLogin.js**

`backend/src/middlewares/autenticar.js`:
```js
import { verificar } from '../config/jwt.js';

export function autenticar(req, res, next) {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');
  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Token não informado.' });
  }
  try {
    const payload = verificar(token);
    req.usuarioId = Number(payload.sub);
    return next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}
```

`backend/src/middlewares/limitadorLogin.js`:
```js
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.teste,
  handler: (req, res) => res.status(429).json({ erro: 'Muitas tentativas de login. Tente novamente em alguns minutos.' }),
});
```

- [ ] **Step 6: middlewares/validar.js (helpers compartilhados)**

`backend/src/middlewares/validar.js`:
```js
import { ErroApi, naoEncontrado } from './erros.js';
import { dataValida, mesCorrente } from '../models/datas.js';

export function criarValidador(fn) {
  return (req, res, next) => {
    const campos = {};
    const dados = fn(req.body ?? {}, campos, req);
    if (Object.keys(campos).length > 0) return next(new ErroApi(400, 'Dados inválidos.', campos));
    req.dados = dados;
    return next();
  };
}

export const texto = (v) => (typeof v === 'string' ? v.trim() : '');

export function inteiroPositivo(v) {
  const n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v;
  return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}

// Aceita número ou string "123.45" (ponto); no máximo 2 casas; > 0.
export function valorMonetario(v) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d{1,2})?$/.test(v.trim()) ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 9999999999.99) return null;
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return null;
  return Math.round(n * 100) / 100;
}

// Para router.param('id', validarId): id não numérico -> 404
export function validarId(req, res, next, id) {
  if (!/^\d+$/.test(id) || Number(id) > 2147483647) return next(naoEncontrado());
  return next();
}

// Lê ?inicio=&fim= (padrão: mês corrente) e preenche req.periodo
export function validarPeriodo(req, res, next) {
  const padrao = mesCorrente();
  const inicio = req.query.inicio ?? padrao.inicio;
  const fim = req.query.fim ?? padrao.fim;
  const campos = {};
  if (!dataValida(inicio)) campos.inicio = 'Informe uma data inicial válida (AAAA-MM-DD).';
  if (!dataValida(fim)) campos.fim = 'Informe uma data final válida (AAAA-MM-DD).';
  if (Object.keys(campos).length === 0 && inicio > fim) campos.inicio = 'A data inicial deve ser anterior ou igual à final.';
  if (Object.keys(campos).length > 0) return next(new ErroApi(400, 'Período inválido.', campos));
  req.periodo = { inicio, fim };
  return next();
}
```

- [ ] **Step 7: middlewares/validarAuth.js**

`backend/src/middlewares/validarAuth.js`:
```js
import { criarValidador, texto } from './validar.js';
import { cpfValido } from '../models/cpf.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validarCadastro = criarValidador((b, campos) => {
  const nome = texto(b.nome);
  const email = texto(b.email).toLowerCase();
  const cpf = String(b.cpf ?? '').replace(/\D/g, '');
  const senha = typeof b.senha === 'string' ? b.senha : '';

  if (!nome) campos.nome = 'Informe o nome.';
  else if (nome.length > 120) campos.nome = 'O nome deve ter no máximo 120 caracteres.';

  if (!email) campos.email = 'Informe o e-mail.';
  else if (!EMAIL.test(email) || email.length > 160) campos.email = 'E-mail inválido.';

  if (!cpf) campos.cpf = 'Informe o CPF.';
  else if (!cpfValido(cpf)) campos.cpf = 'CPF inválido.';

  if (!senha) campos.senha = 'Informe a senha.';
  else if (senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    campos.senha = 'A senha deve ter no mínimo 8 caracteres, com letras e números.';
  } else if (senha.length > 72) campos.senha = 'A senha deve ter no máximo 72 caracteres.';

  if (b.confirmarSenha !== undefined && b.confirmarSenha !== senha) {
    campos.confirmarSenha = 'As senhas não conferem.';
  }
  return { nome, email, cpf, senha };
});

export const validarLogin = criarValidador((b, campos) => {
  const email = texto(b.email).toLowerCase();
  const senha = typeof b.senha === 'string' ? b.senha : '';
  if (!email) campos.email = 'Informe o e-mail.';
  if (!senha) campos.senha = 'Informe a senha.';
  return { email, senha };
});
```

- [ ] **Step 8: models de usuário, categoria padrão e fonte padrão**

`backend/src/models/usuario.js`:
```js
import { pool } from '../config/db.js';

export async function criar({ nome, email, cpf, senhaHash }, exec = pool) {
  const { rows } = await exec.query(
    'INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES ($1, $2, $3, $4) RETURNING id, nome, email',
    [nome, email, cpf, senhaHash],
  );
  return rows[0];
}

export async function buscarPorEmail(email) {
  const { rows } = await pool.query('SELECT id, nome, email, senha_hash FROM usuarios WHERE email = $1', [email]);
  return rows[0] ?? null;
}

export async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT id, nome, email FROM usuarios WHERE id = $1', [id]);
  return rows[0] ?? null;
}
```

`backend/src/models/categoria.js`:
```js
import { pool } from '../config/db.js';

export const PADRAO = [
  ['Salário', 'entrada'], ['Outros', 'entrada'],
  ['Alimentação', 'saida'], ['Moradia', 'saida'], ['Saúde', 'saida'], ['Mobilidade', 'saida'],
  ['Lazer', 'saida'], ['Educação', 'saida'], ['Outros', 'saida'],
];

export async function criarPadrao(usuarioId, exec = pool) {
  for (const [nome, tipo] of PADRAO) {
    await exec.query('INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3)', [usuarioId, nome, tipo]);
  }
}
```

`backend/src/models/fonteDestino.js`:
```js
import { pool } from '../config/db.js';

export async function criarPadrao(usuarioId, exec = pool) {
  await exec.query(
    "INSERT INTO fontes_destinos (usuario_id, nome, tipo) VALUES ($1, 'Conta corrente', 'conta')",
    [usuarioId],
  );
}
```

- [ ] **Step 9: routes/auth.routes.js**

`backend/src/routes/auth.routes.js`:
```js
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { transacao } from '../config/db.js';
import { assinar } from '../config/jwt.js';
import { autenticar } from '../middlewares/autenticar.js';
import { limitadorLogin } from '../middlewares/limitadorLogin.js';
import { validarCadastro, validarLogin } from '../middlewares/validarAuth.js';
import * as Usuario from '../models/usuario.js';
import * as Categoria from '../models/categoria.js';
import * as FonteDestino from '../models/fonteDestino.js';

const router = Router();

// Hash descartável: login com e-mail inexistente gasta o mesmo tempo de um login real.
const HASH_FALSO = bcrypt.hashSync('senha-descartavel-1', 10);

router.post('/cadastro', validarCadastro, async (req, res) => {
  const { nome, email, cpf, senha } = req.dados;
  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await transacao(async (client) => {
      const novo = await Usuario.criar({ nome, email, cpf, senhaHash }, client);
      await Categoria.criarPadrao(novo.id, client);
      await FonteDestino.criarPadrao(novo.id, client);
      return novo;
    });
    return res.status(201).json(usuario);
  } catch (erro) {
    if (erro.code === '23505') { // unique_violation: a garantia é do banco
      const campo = erro.constraint?.includes('cpf') ? 'cpf' : 'email';
      return res.status(409).json({
        erro: 'Usuário já cadastrado.',
        campos: { [campo]: `Já existe um usuário com este ${campo === 'cpf' ? 'CPF' : 'e-mail'}.` },
      });
    }
    throw erro;
  }
});

router.post('/login', limitadorLogin, validarLogin, async (req, res) => {
  const { email, senha } = req.dados;
  const usuario = await Usuario.buscarPorEmail(email);
  const confere = await bcrypt.compare(senha, usuario?.senha_hash ?? HASH_FALSO);
  if (!usuario || !confere) return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
  return res.json({
    token: assinar(usuario.id),
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
  });
});

router.get('/me', autenticar, async (req, res) => {
  const usuario = await Usuario.buscarPorId(req.usuarioId);
  if (!usuario) return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  return res.json(usuario);
});

export default router;
```

- [ ] **Step 10: server.js**

`backend/src/server.js`:
```js
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js';
import authRoutes from './routes/auth.routes.js';

export const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.use('/api/auth', authRoutes);

app.use(rotaNaoEncontrada);
app.use(tratarErros);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(env.porta, () => console.log(`API em http://localhost:${env.porta}`));
}
```

- [ ] **Step 11: Rodar os testes de auth**

Run: `cd backend && node --test test/auth.test.js`
Expected: PASS em todos os testes. Se algum falhar, corrija a implementação (não o teste) a menos que o teste contradiga o PDF.

- [ ] **Step 12: Checkpoint de commit**

```bash
git add backend/src backend/test
git commit -m "feat: cadastro, login, JWT, erros centralizados e testes de autenticação"
```

---

### Task 4: Front-end base, AuthContext, login e cadastro

**Files:**
- Create: `frontend/package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/styles.css`, `src/services/api.js`, `src/contexts/AuthContext.jsx`, `src/utils/{formatar,mascaras,cpf,useCarregar}.js`, `src/components/layout/{Layout,RotaProtegida}.jsx`, `src/components/comuns/{Estados,CampoForm,Modal}.jsx`, `src/components/paginas/{Login,Cadastro,Dashboard}.jsx`

**Interfaces:**
- Consumes: API `/api/auth/{cadastro,login,me}` (Task 3).
- Produces:
  - `api.get(caminho)`, `api.post(caminho, corpo)`, `api.put(caminho, corpo)`, `api.delete(caminho)`; `class ApiErro { status, message, campos }`; `definirAoExpirar(fn)`, `lerToken()`, `salvarToken(t)`, `limparToken()`.
  - `useAuth() → { usuario, token, carregando, login(email, senha), logout(), cadastrar(dados) }`.
  - `useCarregar(fn, deps) → { dados, carregando, erro, recarregar }`.
  - `<Estado carregando erro vazio textoVazio recarregar>children</Estado>`, `<CampoForm id rotulo erro>`, `<Modal titulo aoFechar>`.
  - `moeda(v)`, `dataBR(iso)`, `mesAtual() → {inicio, fim}`, `hojeISO()`, `percentual(v)`, `mesExtenso('AAAA-MM')`; `mascararCpf`, `mascararValor`, `valorParaNumero`, `numeroParaCampo`; `cpfValido`.

- [ ] **Step 1: package.json e dependências**

`frontend/package.json`:
```json
{
  "name": "financas-frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```
Run:
```bash
cd frontend
npm install react react-dom react-router-dom recharts
npm install -D vite @vitejs/plugin-react
```
Expected: instalação sem erro.

- [ ] **Step 2: Vite e index.html**

`frontend/vite.config.js`:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
```

`frontend/index.html`:
```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Controle Financeiro</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Cliente HTTP único**

`frontend/src/services/api.js`:
```js
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const CHAVE = 'token';

let aoExpirar = () => {};
export const definirAoExpirar = (fn) => { aoExpirar = fn; };

export function lerToken() {
  try { return localStorage.getItem(CHAVE); } catch { return null; }
}
export function salvarToken(token) {
  try { localStorage.setItem(CHAVE, token); } catch { /* sessão só em memória */ }
}
export function limparToken() {
  try { localStorage.removeItem(CHAVE); } catch { /* ignora */ }
}

export class ApiErro extends Error {
  constructor(status, mensagem, campos = {}) {
    super(mensagem);
    this.status = status;
    this.campos = campos;
  }
}

async function requisitar(metodo, caminho, corpo) {
  const token = lerToken();
  const headers = {};
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let resposta;
  try {
    resposta = await fetch(BASE + caminho, {
      method: metodo,
      headers,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ApiErro(0, 'Não foi possível conectar ao servidor.');
  }

  if (resposta.status === 204) return null;
  const dados = await resposta.json().catch(() => null);

  // 401 com token enviado = sessão expirada/inválida: faz logout e volta ao login.
  if (resposta.status === 401 && token) {
    aoExpirar();
    throw new ApiErro(401, dados?.erro ?? 'Sessão expirada.');
  }
  if (!resposta.ok) throw new ApiErro(resposta.status, dados?.erro ?? 'Erro inesperado.', dados?.campos ?? {});
  return dados;
}

export const api = {
  get: (caminho) => requisitar('GET', caminho),
  post: (caminho, corpo) => requisitar('POST', caminho, corpo ?? {}),
  put: (caminho, corpo) => requisitar('PUT', caminho, corpo ?? {}),
  delete: (caminho) => requisitar('DELETE', caminho),
};
```

- [ ] **Step 4: AuthContext**

`frontend/src/contexts/AuthContext.jsx`:
```jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, definirAoExpirar, lerToken, limparToken, salvarToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(lerToken);
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(lerToken()));

  const logout = useCallback(() => {
    limparToken();
    setToken(null);
    setUsuario(null);
  }, []);

  useEffect(() => {
    definirAoExpirar(logout);
  }, [logout]);

  // Ao recarregar a página, valida o token guardado.
  useEffect(() => {
    if (!lerToken()) return;
    api.get('/auth/me')
      .then(setUsuario)
      .catch(() => logout())
      .finally(() => setCarregando(false));
  }, [logout]);

  const login = useCallback(async (email, senha) => {
    const dados = await api.post('/auth/login', { email, senha });
    salvarToken(dados.token);
    setToken(dados.token);
    setUsuario(dados.usuario);
  }, []);

  const cadastrar = useCallback(async (dados) => {
    await api.post('/auth/cadastro', dados);
    await login(dados.email, dados.senha);
  }, [login]);

  const valor = useMemo(
    () => ({ usuario, token, carregando, login, logout, cadastrar }),
    [usuario, token, carregando, login, logout, cadastrar],
  );
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 5: Utilitários**

`frontend/src/utils/cpf.js`:
```js
// Valida os dois dígitos verificadores do CPF (mesma regra do back-end)
export function cpfValido(cpf) {
  const d = String(cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}
```

`frontend/src/utils/formatar.js`:
```js
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pad = (n) => String(n).padStart(2, '0');

export const moeda = (v) => brl.format(Number(v ?? 0));

export function dataBR(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function hojeISO() {
  const h = new Date();
  return `${h.getFullYear()}-${pad(h.getMonth() + 1)}-${pad(h.getDate())}`;
}

export function mesAtual() {
  const h = new Date();
  const a = h.getFullYear();
  const m = h.getMonth();
  const ultimo = new Date(a, m + 1, 0).getDate();
  return { inicio: `${a}-${pad(m + 1)}-01`, fim: `${a}-${pad(m + 1)}-${pad(ultimo)}` };
}

export const percentual = (v) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export function mesExtenso(anoMes) {
  const [a, m] = anoMes.split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
```

`frontend/src/utils/mascaras.js`:
```js
export function mascararCpf(v) {
  const d = String(v).replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

// Digita-se só números; o campo mostra "1.234,56"
export function mascararValor(v) {
  const d = String(v).replace(/\D/g, '');
  if (!d) return '';
  return (Number(d) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function valorParaNumero(campo) {
  const n = Number(String(campo).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

export const numeroParaCampo = (n) => mascararValor(String(Math.round(Number(n) * 100)));
```

`frontend/src/utils/useCarregar.js`:
```js
import { useCallback, useEffect, useRef, useState } from 'react';

// Executa fn() ao montar e quando deps mudam. Ignora respostas antigas.
export function useCarregar(fn, deps = []) {
  const [estado, setEstado] = useState({ dados: null, carregando: true, erro: null });
  const contador = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const executar = useCallback(async () => {
    const minha = ++contador.current;
    setEstado((s) => ({ ...s, carregando: true, erro: null }));
    try {
      const dados = await fn();
      if (minha === contador.current) setEstado({ dados, carregando: false, erro: null });
    } catch (e) {
      if (e.status === 401) return; // o AuthContext já voltou ao login
      if (minha === contador.current) setEstado({ dados: null, carregando: false, erro: e.message });
    }
  }, deps);

  useEffect(() => { executar(); }, [executar]);

  return { ...estado, recarregar: executar };
}
```

- [ ] **Step 6: Componentes comuns**

`frontend/src/components/comuns/Estados.jsx`:
```jsx
export function Carregando() {
  return <p className="estado" role="status">Carregando…</p>;
}

export function Vazio({ children }) {
  return <p className="estado">{children}</p>;
}

export function MensagemErro({ mensagem, aoTentar }) {
  return (
    <div className="estado erro-bloco" role="alert">
      <p>{mensagem}</p>
      {aoTentar && <button type="button" onClick={aoTentar}>Tentar novamente</button>}
    </div>
  );
}

// Trata carregando, erro e lista vazia de uma vez
export function Estado({ carregando, erro, vazio, textoVazio = 'Nada por aqui ainda.', recarregar, children }) {
  if (carregando) return <Carregando />;
  if (erro) return <MensagemErro mensagem={erro} aoTentar={recarregar} />;
  if (vazio) return <Vazio>{textoVazio}</Vazio>;
  return children;
}
```

`frontend/src/components/comuns/CampoForm.jsx`:
```jsx
export default function CampoForm({ id, rotulo, erro, children }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      {children}
      {erro && <span className="erro-campo" role="alert">{erro}</span>}
    </div>
  );
}
```

`frontend/src/components/comuns/Modal.jsx`:
```jsx
export default function Modal({ titulo, aoFechar, children }) {
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-topo">
          <h2>{titulo}</h2>
          <button type="button" className="link" onClick={aoFechar} aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Layout e rota protegida**

`frontend/src/components/layout/Layout.jsx`:
```jsx
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

const LINKS = [
  ['/', 'Dashboard'],
  ['/lancamentos', 'Lançamentos'],
  ['/categorias', 'Categorias'],
  ['/fontes-destinos', 'Fontes/Destinos'],
  ['/relatorios', 'Relatórios'],
  ['/faturas', 'Faturas'],
  ['/saude-financeira', 'Saúde financeira'],
];

export default function Layout() {
  const { usuario, logout } = useAuth();
  return (
    <div className="app">
      <aside className="menu">
        <h1>Controle Financeiro</h1>
        <nav>
          {LINKS.map(([para, texto]) => (
            <NavLink key={para} to={para} end={para === '/'}>{texto}</NavLink>
          ))}
        </nav>
        <div className="menu-rodape">
          <span>{usuario?.nome}</span>
          <button type="button" onClick={logout}>Sair</button>
        </div>
      </aside>
      <main className="conteudo"><Outlet /></main>
    </div>
  );
}
```

`frontend/src/components/layout/RotaProtegida.jsx`:
```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { Carregando } from '../comuns/Estados.jsx';
import Layout from './Layout.jsx';

export default function RotaProtegida() {
  const { token, carregando } = useAuth();
  if (carregando) return <Carregando />;
  return token ? <Layout /> : <Navigate to="/login" replace />;
}
```

- [ ] **Step 8: Páginas de login, cadastro e dashboard inicial**

`frontend/src/components/paginas/Login.jsx`:
```jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import CampoForm from '../comuns/CampoForm.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setMensagem('');
    const novos = {};
    if (!form.email.trim()) novos.email = 'Informe o e-mail.';
    if (!form.senha) novos.senha = 'Informe a senha.';
    setErros(novos);
    if (Object.keys(novos).length) return;

    setEnviando(true);
    try {
      await login(form.email, form.senha);
      navigate('/');
    } catch (erro) {
      setErros(erro.campos ?? {});
      setMensagem(erro.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth">
      <form className="cartao" onSubmit={enviar} noValidate>
        <h1>Entrar</h1>
        {mensagem && <p className="erro-bloco" role="alert">{mensagem}</p>}
        <CampoForm id="email" rotulo="E-mail" erro={erros.email}>
          <input id="email" type="email" autoComplete="username" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </CampoForm>
        <CampoForm id="senha" rotulo="Senha" erro={erros.senha}>
          <input id="senha" type="password" autoComplete="current-password" value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })} />
        </CampoForm>
        <button type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <p>Não tem conta? <Link to="/cadastro">Cadastre-se</Link></p>
      </form>
    </div>
  );
}
```

`frontend/src/components/paginas/Cadastro.jsx`:
```jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { cpfValido } from '../../utils/cpf.js';
import { mascararCpf } from '../../utils/mascaras.js';
import CampoForm from '../comuns/CampoForm.jsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validar(f) {
  const e = {};
  if (!f.nome.trim()) e.nome = 'Informe o nome.';
  if (!EMAIL.test(f.email.trim())) e.email = 'E-mail inválido.';
  if (!cpfValido(f.cpf)) e.cpf = 'CPF inválido.';
  if (f.senha.length < 8 || !/[A-Za-z]/.test(f.senha) || !/\d/.test(f.senha)) {
    e.senha = 'A senha deve ter no mínimo 8 caracteres, com letras e números.';
  }
  if (f.confirmarSenha !== f.senha) e.confirmarSenha = 'As senhas não conferem.';
  return e;
}

export default function Cadastro() {
  const { cadastrar } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: '', email: '', cpf: '', senha: '', confirmarSenha: '' });
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  const mudar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setMensagem('');
    const novos = validar(form);
    setErros(novos);
    if (Object.keys(novos).length) return;

    setEnviando(true);
    try {
      await cadastrar({ ...form, nome: form.nome.trim(), email: form.email.trim() });
      navigate('/');
    } catch (erro) {
      setErros(erro.campos ?? {}); // ex.: 409 -> mensagem junto ao campo cpf/email
      setMensagem(erro.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth">
      <form className="cartao" onSubmit={enviar} noValidate>
        <h1>Criar conta</h1>
        {mensagem && <p className="erro-bloco" role="alert">{mensagem}</p>}
        <CampoForm id="nome" rotulo="Nome" erro={erros.nome}>
          <input id="nome" value={form.nome} onChange={mudar('nome')} />
        </CampoForm>
        <CampoForm id="email" rotulo="E-mail" erro={erros.email}>
          <input id="email" type="email" value={form.email} onChange={mudar('email')} />
        </CampoForm>
        <CampoForm id="cpf" rotulo="CPF" erro={erros.cpf}>
          <input id="cpf" inputMode="numeric" value={form.cpf}
            onChange={(e) => setForm({ ...form, cpf: mascararCpf(e.target.value) })} />
        </CampoForm>
        <CampoForm id="senha" rotulo="Senha" erro={erros.senha}>
          <input id="senha" type="password" autoComplete="new-password" value={form.senha} onChange={mudar('senha')} />
        </CampoForm>
        <CampoForm id="confirmarSenha" rotulo="Confirmar senha" erro={erros.confirmarSenha}>
          <input id="confirmarSenha" type="password" autoComplete="new-password" value={form.confirmarSenha}
            onChange={mudar('confirmarSenha')} />
        </CampoForm>
        <button type="submit" disabled={enviando}>{enviando ? 'Cadastrando…' : 'Cadastrar'}</button>
        <p>Já tem conta? <Link to="/login">Entrar</Link></p>
      </form>
    </div>
  );
}
```

`frontend/src/components/paginas/Dashboard.jsx` (versão inicial, substituída na Task 7):
```jsx
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function Dashboard() {
  const { usuario } = useAuth();
  return (
    <section>
      <h2>Olá, {usuario?.nome}</h2>
      <p>Use o menu para começar.</p>
    </section>
  );
}
```

- [ ] **Step 9: App, main e estilos**

`frontend/src/App.jsx`:
```jsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import RotaProtegida from './components/layout/RotaProtegida.jsx';
import Login from './components/paginas/Login.jsx';
import Cadastro from './components/paginas/Cadastro.jsx';
import Dashboard from './components/paginas/Dashboard.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route element={<RotaProtegida />}>
            <Route path="/" element={<Dashboard />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

`frontend/src/main.jsx`:
```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
```

`frontend/src/styles.css`:
```css
:root { --azul: #1d4ed8; --verde: #15803d; --vermelho: #b91c1c; --borda: #d4d4d8; --fundo: #f4f4f5; font-family: system-ui, sans-serif; color: #18181b; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--fundo); }
h1, h2, h3 { margin: 0 0 .75rem; }
button { background: var(--azul); color: #fff; border: 0; border-radius: 6px; padding: .5rem .9rem; cursor: pointer; font: inherit; }
button:disabled { opacity: .6; cursor: default; }
button.secundario { background: #fff; color: #18181b; border: 1px solid var(--borda); }
button.perigo { background: var(--vermelho); }
button.link { background: none; color: var(--azul); padding: .2rem .4rem; }
input, select { width: 100%; padding: .5rem; border: 1px solid var(--borda); border-radius: 6px; font: inherit; background: #fff; }
.campo { margin-bottom: .9rem; display: flex; flex-direction: column; gap: .25rem; }
.erro-campo { color: var(--vermelho); font-size: .85rem; }
.erro-bloco { color: var(--vermelho); background: #fee2e2; padding: .6rem .8rem; border-radius: 6px; }
.estado { text-align: center; color: #52525b; padding: 1.5rem; }
.auth { min-height: 100vh; display: grid; place-items: center; padding: 1rem; }
.cartao { background: #fff; padding: 1.5rem; border-radius: 10px; width: min(420px, 100%); box-shadow: 0 1px 4px #0002; }
.app { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }
.menu { background: #18181b; color: #fff; padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }
.menu h1 { font-size: 1.1rem; }
.menu nav { display: flex; flex-direction: column; gap: .25rem; }
.menu nav a { color: #d4d4d8; text-decoration: none; padding: .45rem .6rem; border-radius: 6px; }
.menu nav a.active { background: #3f3f46; color: #fff; }
.menu-rodape { margin-top: auto; display: flex; flex-direction: column; gap: .5rem; font-size: .9rem; }
.conteudo { padding: 1.5rem; min-width: 0; }
.barra { display: flex; flex-wrap: wrap; gap: .75rem; align-items: flex-end; margin-bottom: 1rem; }
.barra .campo { margin: 0; min-width: 140px; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: .75rem; margin-bottom: 1rem; }
.card { background: #fff; border-radius: 8px; padding: .9rem; box-shadow: 0 1px 3px #0002; }
.card small { color: #52525b; display: block; }
.card strong { font-size: 1.25rem; }
table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; }
th, td { text-align: left; padding: .55rem .7rem; border-bottom: 1px solid var(--borda); }
th { background: #e4e4e7; font-size: .85rem; }
td.num, th.num { text-align: right; }
.entrada { color: var(--verde); }
.saida { color: var(--vermelho); }
.acoes { display: flex; gap: .4rem; }
.modal-fundo { position: fixed; inset: 0; background: #0006; display: grid; place-items: center; padding: 1rem; z-index: 10; }
.modal { background: #fff; border-radius: 10px; padding: 1.25rem; width: min(480px, 100%); max-height: 90vh; overflow: auto; }
.modal-topo { display: flex; justify-content: space-between; align-items: center; }
.abas { display: flex; gap: .5rem; margin-bottom: 1rem; }
.abas button { background: #fff; color: #18181b; border: 1px solid var(--borda); }
.abas button.ativa { background: var(--azul); color: #fff; }
.grafico { height: 300px; background: #fff; border-radius: 8px; padding: .5rem; margin: 1rem 0; }
.aviso { background: #fef9c3; border-left: 4px solid #ca8a04; padding: .7rem 1rem; border-radius: 6px; margin-bottom: 1rem; }
.dica { background: #fff; border-left: 4px solid var(--azul); padding: .6rem .9rem; margin-bottom: .5rem; border-radius: 6px; }
.dica.alerta { border-color: var(--vermelho); }
.dica.ok { border-color: var(--verde); }
@media (max-width: 760px) { .app { grid-template-columns: 1fr; } .menu nav { flex-direction: row; flex-wrap: wrap; } }
```

- [ ] **Step 10: Verificar build e fluxo no navegador**

Run: `cd frontend && npm run build`
Expected: build conclui sem erros.

Depois, em dois terminais: `cd backend && npm run dev` e `cd frontend && npm run dev`. Abra `http://localhost:5173`:
1. Sem sessão, `/` redireciona para `/login`.
2. Em `/cadastro`, cadastre um usuário (CPF válido). Deve entrar e ver "Olá, <nome>".
3. Recarregue a página: continua logado.
4. Clique em Sair: volta ao login.
5. Cadastre outro usuário com o mesmo e-mail: a mensagem aparece junto ao campo E-mail. Repita com o mesmo CPF: aparece junto ao campo CPF.
6. Logado, apague o token no DevTools (`localStorage`) e recarregue: volta ao login sem erro na tela.

- [ ] **Step 11: Checkpoint de commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/index.html frontend/src
git commit -m "feat: base do front-end, AuthContext, login e cadastro"
```

---

### Task 5: CRUD de categorias e fontes/destinos (back-end e front-end)

**Files:**
- Create: `backend/src/middlewares/validarCadastros.js`, `backend/src/routes/categorias.routes.js`, `backend/src/routes/fontes-destinos.routes.js`, `frontend/src/components/paginas/Categorias.jsx`, `frontend/src/components/paginas/FontesDestinos.jsx`
- Modify: `backend/src/models/categoria.js`, `backend/src/models/fonteDestino.js`, `backend/src/server.js`, `frontend/src/App.jsx`
- Test: `backend/test/cadastros.test.js`

**Interfaces:**
- Consumes: `criarValidador`, `texto`, `inteiroPositivo`, `valorMonetario`, `validarId`, `ErroApi`, `naoEncontrado`, `traduzirDuplicata`, `autenticar`.
- Produces:
  - `Categoria.listar(usuarioId) → [{id,nome,tipo}]`, `buscar(usuarioId,id) → obj|null`, `criar(usuarioId,{nome,tipo})`, `atualizar(usuarioId,id,{nome,tipo}) → obj|null`, `contarLancamentos(usuarioId,id) → number`, `excluir(usuarioId,id) → boolean`.
  - `FonteDestino.listar/buscar/criar/atualizar/contarLancamentos/excluir` com objeto `{id,nome,tipo,diaFechamento,diaVencimento,limite,reserva}`; `criar`/`atualizar` recebem `{nome,tipo,diaFechamento,diaVencimento,limite,reserva}`.
  - Rotas `/api/categorias[/:id]` e `/api/fontes-destinos[/:id]` com os códigos da Tabela 10.5.

- [ ] **Step 1: Testes (falham primeiro)**

`backend/test/cadastros.test.js`:
```js
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar, encerrar, requisitar, pool, criarUsuario } from './helpers.js';

let a;
let b;
before(async () => {
  await iniciar();
  a = await criarUsuario('A');
  b = await criarUsuario('B');
});
after(encerrar);

const ids = async (token, rota) => (await requisitar('GET', rota, { token })).corpo;

test('rotas protegidas exigem token', async () => {
  for (const rota of ['/categorias', '/fontes-destinos']) {
    assert.equal((await requisitar('GET', rota)).status, 401);
  }
});

test('categorias: lista as padrão, cria, edita e exclui', async () => {
  const lista = await ids(a.token, '/categorias');
  assert.equal(lista.length, 9);

  const criada = await requisitar('POST', '/categorias', { token: a.token, corpo: { nome: 'Pets', tipo: 'saida' } });
  assert.equal(criada.status, 201);
  assert.equal(criada.corpo.nome, 'Pets');

  const editada = await requisitar('PUT', `/categorias/${criada.corpo.id}`, { token: a.token, corpo: { nome: 'Animais', tipo: 'saida' } });
  assert.equal(editada.status, 200);
  assert.equal(editada.corpo.nome, 'Animais');

  const excluida = await requisitar('DELETE', `/categorias/${criada.corpo.id}`, { token: a.token });
  assert.equal(excluida.status, 204);
});

test('categorias: nome repetido no mesmo tipo é 409; em outro tipo é permitido', async () => {
  const dup = await requisitar('POST', '/categorias', { token: a.token, corpo: { nome: 'Lazer', tipo: 'saida' } });
  assert.equal(dup.status, 409);
  assert.ok(dup.corpo.campos.nome);
  const outroTipo = await requisitar('POST', '/categorias', { token: a.token, corpo: { nome: 'Lazer', tipo: 'entrada' } });
  assert.equal(outroTipo.status, 201);
});

test('categorias: validação 400', async () => {
  const r = await requisitar('POST', '/categorias', { token: a.token, corpo: { nome: ' ', tipo: 'outro' } });
  assert.equal(r.status, 400);
  assert.ok(r.corpo.campos.nome && r.corpo.campos.tipo);
  assert.equal((await requisitar('POST', '/categorias', { token: a.token })).status, 400);
});

test('categorias: não exclui com lançamentos (409)', async () => {
  const cats = await ids(a.token, '/categorias');
  const fontes = await ids(a.token, '/fontes-destinos');
  const cat = cats.find((c) => c.tipo === 'saida');
  await pool.query(
    `INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id)
     VALUES ($1, 'saida', 'teste', 10, '2026-01-10', $2, $3)`,
    [a.id, cat.id, fontes[0].id],
  );
  const r = await requisitar('DELETE', `/categorias/${cat.id}`, { token: a.token });
  assert.equal(r.status, 409);
  assert.ok(r.corpo.erro);
  const tipo = await requisitar('PUT', `/categorias/${cat.id}`, { token: a.token, corpo: { nome: cat.nome, tipo: 'entrada' } });
  assert.equal(tipo.status, 409);
});

test('fontes: cartão exige fechamento, vencimento e limite (400)', async () => {
  const r = await requisitar('POST', '/fontes-destinos', { token: a.token, corpo: { nome: 'Nubank', tipo: 'cartao_credito' } });
  assert.equal(r.status, 400);
  for (const c of ['diaFechamento', 'diaVencimento', 'limite']) assert.ok(r.corpo.campos[c], c);
  const dia = await requisitar('POST', '/fontes-destinos', {
    token: a.token, corpo: { nome: 'Visa', tipo: 'cartao_credito', diaFechamento: 32, diaVencimento: 0, limite: 1000 },
  });
  assert.equal(dia.status, 400);
});

test('fontes: cria cartão e conta, edita, duplicado é 409', async () => {
  const cartao = await requisitar('POST', '/fontes-destinos', {
    token: a.token, corpo: { nome: 'Nubank', tipo: 'cartao_credito', diaFechamento: 3, diaVencimento: 10, limite: 5000 },
  });
  assert.equal(cartao.status, 201);
  assert.equal(cartao.corpo.limite, 5000);
  assert.equal(cartao.corpo.reserva, false);

  const poupanca = await requisitar('POST', '/fontes-destinos', {
    token: a.token, corpo: { nome: 'Poupança', tipo: 'conta', reserva: true, diaFechamento: 5 },
  });
  assert.equal(poupanca.status, 201);
  assert.equal(poupanca.corpo.reserva, true);
  assert.equal(poupanca.corpo.diaFechamento, null);

  const editada = await requisitar('PUT', `/fontes-destinos/${cartao.corpo.id}`, {
    token: a.token, corpo: { nome: 'Nubank Roxo', tipo: 'cartao_credito', diaFechamento: 4, diaVencimento: 11, limite: 6000 },
  });
  assert.equal(editada.status, 200);
  assert.equal(editada.corpo.diaFechamento, 4);

  const dup = await requisitar('POST', '/fontes-destinos', { token: a.token, corpo: { nome: 'Poupança', tipo: 'conta' } });
  assert.equal(dup.status, 409);
});

test('fontes: não exclui com lançamentos (409)', async () => {
  const fontes = await ids(a.token, '/fontes-destinos');
  const conta = fontes.find((f) => f.nome === 'Conta corrente');
  const r = await requisitar('DELETE', `/fontes-destinos/${conta.id}`, { token: a.token });
  assert.equal(r.status, 409);
});

test('isolamento: B não lê, edita nem exclui dados de A (404)', async () => {
  const cat = (await ids(a.token, '/categorias'))[0];
  const fonte = (await ids(a.token, '/fontes-destinos'))[0];
  const corpoCat = { nome: 'Invasão', tipo: cat.tipo };
  assert.equal((await requisitar('PUT', `/categorias/${cat.id}`, { token: b.token, corpo: corpoCat })).status, 404);
  assert.equal((await requisitar('DELETE', `/categorias/${cat.id}`, { token: b.token })).status, 404);
  assert.equal((await requisitar('PUT', `/fontes-destinos/${fonte.id}`, { token: b.token, corpo: { nome: 'x', tipo: 'conta' } })).status, 404);
  assert.equal((await requisitar('DELETE', `/fontes-destinos/${fonte.id}`, { token: b.token })).status, 404);
  const doB = await ids(b.token, '/categorias');
  assert.equal(doB.some((c) => c.id === cat.id), false);
  const aindaExiste = await ids(a.token, '/categorias');
  assert.equal(aindaExiste.find((c) => c.id === cat.id).nome, cat.nome);
});

test('Review Focus 2: id não numérico ou gigante é 404, não 500', async () => {
  for (const id of ['abc', '1.5', '99999999999999999999', '-1']) {
    assert.equal((await requisitar('DELETE', `/categorias/${id}`, { token: a.token })).status, 404, id);
    assert.equal((await requisitar('PUT', `/fontes-destinos/${id}`, { token: a.token, corpo: { nome: 'x', tipo: 'conta' } })).status, 404, id);
  }
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && node --test test/cadastros.test.js`
Expected: FAIL (rotas inexistentes → 404 onde se espera 200/201).

- [ ] **Step 3: Models completos**

Substituir `backend/src/models/categoria.js` por:
```js
import { pool } from '../config/db.js';

export const PADRAO = [
  ['Salário', 'entrada'], ['Outros', 'entrada'],
  ['Alimentação', 'saida'], ['Moradia', 'saida'], ['Saúde', 'saida'], ['Mobilidade', 'saida'],
  ['Lazer', 'saida'], ['Educação', 'saida'], ['Outros', 'saida'],
];

const mapa = (r) => ({ id: r.id, nome: r.nome, tipo: r.tipo });

export async function criarPadrao(usuarioId, exec = pool) {
  for (const [nome, tipo] of PADRAO) {
    await exec.query('INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3)', [usuarioId, nome, tipo]);
  }
}

export async function listar(usuarioId) {
  const { rows } = await pool.query(
    'SELECT id, nome, tipo FROM categorias WHERE usuario_id = $1 ORDER BY tipo, nome', [usuarioId]);
  return rows.map(mapa);
}

export async function buscar(usuarioId, id) {
  const { rows } = await pool.query(
    'SELECT id, nome, tipo FROM categorias WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rows[0] ? mapa(rows[0]) : null;
}

export async function criar(usuarioId, { nome, tipo }) {
  const { rows } = await pool.query(
    'INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id, nome, tipo',
    [usuarioId, nome, tipo]);
  return mapa(rows[0]);
}

export async function atualizar(usuarioId, id, { nome, tipo }) {
  const { rows } = await pool.query(
    'UPDATE categorias SET nome = $3, tipo = $4 WHERE id = $1 AND usuario_id = $2 RETURNING id, nome, tipo',
    [id, usuarioId, nome, tipo]);
  return rows[0] ? mapa(rows[0]) : null;
}

export async function contarLancamentos(usuarioId, id) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM lancamentos WHERE categoria_id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rows[0].n;
}

export async function excluir(usuarioId, id) {
  const r = await pool.query('DELETE FROM categorias WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return r.rowCount > 0;
}
```

Substituir `backend/src/models/fonteDestino.js` por:
```js
import { pool } from '../config/db.js';

const COLUNAS = 'id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva';
const mapa = (r) => ({
  id: r.id, nome: r.nome, tipo: r.tipo,
  diaFechamento: r.dia_fechamento, diaVencimento: r.dia_vencimento,
  limite: r.limite, reserva: r.reserva,
});

export async function criarPadrao(usuarioId, exec = pool) {
  await exec.query(
    "INSERT INTO fontes_destinos (usuario_id, nome, tipo) VALUES ($1, 'Conta corrente', 'conta')",
    [usuarioId],
  );
}

export async function listar(usuarioId) {
  const { rows } = await pool.query(
    `SELECT ${COLUNAS} FROM fontes_destinos WHERE usuario_id = $1 ORDER BY tipo, nome`, [usuarioId]);
  return rows.map(mapa);
}

export async function buscar(usuarioId, id) {
  const { rows } = await pool.query(
    `SELECT ${COLUNAS} FROM fontes_destinos WHERE id = $1 AND usuario_id = $2`, [id, usuarioId]);
  return rows[0] ? mapa(rows[0]) : null;
}

export async function criar(usuarioId, d) {
  const { rows } = await pool.query(
    `INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUNAS}`,
    [usuarioId, d.nome, d.tipo, d.diaFechamento, d.diaVencimento, d.limite, d.reserva]);
  return mapa(rows[0]);
}

export async function atualizar(usuarioId, id, d) {
  const { rows } = await pool.query(
    `UPDATE fontes_destinos
        SET nome = $3, tipo = $4, dia_fechamento = $5, dia_vencimento = $6, limite = $7, reserva = $8
      WHERE id = $1 AND usuario_id = $2 RETURNING ${COLUNAS}`,
    [id, usuarioId, d.nome, d.tipo, d.diaFechamento, d.diaVencimento, d.limite, d.reserva]);
  return rows[0] ? mapa(rows[0]) : null;
}

export async function contarLancamentos(usuarioId, id) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM lancamentos WHERE fonte_destino_id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rows[0].n;
}

export async function excluir(usuarioId, id) {
  const r = await pool.query('DELETE FROM fontes_destinos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return r.rowCount > 0;
}
```

- [ ] **Step 4: Validadores**

`backend/src/middlewares/validarCadastros.js`:
```js
import { criarValidador, texto, inteiroPositivo, valorMonetario } from './validar.js';

const dia = (v) => {
  const n = inteiroPositivo(v);
  return n !== null && n <= 31 ? n : null;
};

export const validarCategoria = criarValidador((b, campos) => {
  const nome = texto(b.nome);
  const tipo = b.tipo;
  if (!nome) campos.nome = 'Informe o nome.';
  else if (nome.length > 60) campos.nome = 'O nome deve ter no máximo 60 caracteres.';
  if (!['entrada', 'saida'].includes(tipo)) campos.tipo = 'Tipo inválido. Use entrada ou saida.';
  return { nome, tipo };
});

export const validarFonteDestino = criarValidador((b, campos) => {
  const nome = texto(b.nome);
  const tipo = b.tipo;
  if (!nome) campos.nome = 'Informe o nome.';
  else if (nome.length > 60) campos.nome = 'O nome deve ter no máximo 60 caracteres.';
  if (!['renda', 'conta', 'cartao_credito'].includes(tipo)) {
    campos.tipo = 'Tipo inválido. Use renda, conta ou cartao_credito.';
  }
  const dados = { nome, tipo, diaFechamento: null, diaVencimento: null, limite: null, reserva: b.reserva === true };
  if (tipo === 'cartao_credito') {
    dados.diaFechamento = dia(b.diaFechamento);
    dados.diaVencimento = dia(b.diaVencimento);
    dados.limite = valorMonetario(b.limite);
    if (dados.diaFechamento === null) campos.diaFechamento = 'Informe o dia de fechamento (1 a 31).';
    if (dados.diaVencimento === null) campos.diaVencimento = 'Informe o dia de vencimento (1 a 31).';
    if (dados.limite === null) campos.limite = 'Informe o limite do cartão (maior que zero).';
  }
  return dados;
});
```

- [ ] **Step 5: Rotas**

`backend/src/routes/categorias.routes.js`:
```js
import { Router } from 'express';
import { ErroApi, naoEncontrado, traduzirDuplicata } from '../middlewares/erros.js';
import { validarId } from '../middlewares/validar.js';
import { validarCategoria } from '../middlewares/validarCadastros.js';
import * as Categoria from '../models/categoria.js';

const router = Router();
router.param('id', validarId);

const DUPLICADA = 'Já existe uma categoria com este nome para este tipo.';

router.get('/', async (req, res) => res.json(await Categoria.listar(req.usuarioId)));

router.post('/', validarCategoria, async (req, res) => {
  try {
    res.status(201).json(await Categoria.criar(req.usuarioId, req.dados));
  } catch (erro) {
    throw traduzirDuplicata(erro, DUPLICADA);
  }
});

router.put('/:id', validarCategoria, async (req, res) => {
  const id = Number(req.params.id);
  const atual = await Categoria.buscar(req.usuarioId, id);
  if (!atual) throw naoEncontrado('Categoria não encontrada.');
  if (atual.tipo !== req.dados.tipo && (await Categoria.contarLancamentos(req.usuarioId, id)) > 0) {
    throw new ErroApi(409, 'Não é possível alterar o tipo de uma categoria que possui lançamentos.', {
      tipo: 'A categoria possui lançamentos.',
    });
  }
  try {
    res.json(await Categoria.atualizar(req.usuarioId, id, req.dados));
  } catch (erro) {
    throw traduzirDuplicata(erro, DUPLICADA);
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!(await Categoria.buscar(req.usuarioId, id))) throw naoEncontrado('Categoria não encontrada.');
  if ((await Categoria.contarLancamentos(req.usuarioId, id)) > 0) {
    throw new ErroApi(409, 'Não é possível excluir uma categoria que possui lançamentos. Mova ou exclua os lançamentos antes.');
  }
  await Categoria.excluir(req.usuarioId, id);
  res.status(204).end();
});

export default router;
```

`backend/src/routes/fontes-destinos.routes.js`:
```js
import { Router } from 'express';
import { ErroApi, naoEncontrado, traduzirDuplicata } from '../middlewares/erros.js';
import { validarId } from '../middlewares/validar.js';
import { validarFonteDestino } from '../middlewares/validarCadastros.js';
import * as FonteDestino from '../models/fonteDestino.js';

const router = Router();
router.param('id', validarId);

const DUPLICADA = 'Já existe uma fonte/destino com este nome.';

router.get('/', async (req, res) => res.json(await FonteDestino.listar(req.usuarioId)));

router.post('/', validarFonteDestino, async (req, res) => {
  try {
    res.status(201).json(await FonteDestino.criar(req.usuarioId, req.dados));
  } catch (erro) {
    throw traduzirDuplicata(erro, DUPLICADA);
  }
});

router.put('/:id', validarFonteDestino, async (req, res) => {
  const id = Number(req.params.id);
  if (!(await FonteDestino.buscar(req.usuarioId, id))) throw naoEncontrado('Fonte/destino não encontrada.');
  try {
    res.json(await FonteDestino.atualizar(req.usuarioId, id, req.dados));
  } catch (erro) {
    throw traduzirDuplicata(erro, DUPLICADA);
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!(await FonteDestino.buscar(req.usuarioId, id))) throw naoEncontrado('Fonte/destino não encontrada.');
  if ((await FonteDestino.contarLancamentos(req.usuarioId, id)) > 0) {
    throw new ErroApi(409, 'Não é possível excluir uma fonte/destino que possui lançamentos. Mova ou exclua os lançamentos antes.');
  }
  await FonteDestino.excluir(req.usuarioId, id);
  res.status(204).end();
});

export default router;
```

Em `backend/src/server.js`, adicionar os imports e as rotas:
```js
import { autenticar } from './middlewares/autenticar.js';
import categoriasRoutes from './routes/categorias.routes.js';
import fontesDestinosRoutes from './routes/fontes-destinos.routes.js';
```
```js
app.use('/api/categorias', autenticar, categoriasRoutes);
app.use('/api/fontes-destinos', autenticar, fontesDestinosRoutes);
```
(as duas linhas `app.use` vão logo abaixo de `app.use('/api/auth', authRoutes);`)

- [ ] **Step 6: Rodar os testes**

Run: `cd backend && node --test test/cadastros.test.js`
Expected: PASS em todos. Depois `npm test` completo: PASS.

- [ ] **Step 7: Páginas do front**

`frontend/src/components/paginas/Categorias.jsx`:
```jsx
import { useState } from 'react';
import { api } from '../../services/api.js';
import { useCarregar } from '../../utils/useCarregar.js';
import { Estado } from '../comuns/Estados.jsx';
import Modal from '../comuns/Modal.jsx';
import CampoForm from '../comuns/CampoForm.jsx';

const ROTULO = { entrada: 'Entrada', saida: 'Saída' };

export default function Categorias() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/categorias'), []);
  const [editando, setEditando] = useState(null); // null fechado; {} novo; objeto = edição
  const [form, setForm] = useState({ nome: '', tipo: 'saida' });
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');

  function abrir(cat) {
    setEditando(cat);
    setForm(cat.id ? { nome: cat.nome, tipo: cat.tipo } : { nome: '', tipo: 'saida' });
    setErros({});
    setMensagem('');
  }

  async function salvar(e) {
    e.preventDefault();
    try {
      if (editando.id) await api.put(`/categorias/${editando.id}`, form);
      else await api.post('/categorias', form);
      setEditando(null);
      recarregar();
    } catch (err) {
      setErros(err.campos ?? {});
      setMensagem(err.message);
    }
  }

  async function excluir(cat) {
    if (!window.confirm(`Excluir a categoria "${cat.nome}"?`)) return;
    try {
      await api.delete(`/categorias/${cat.id}`);
      recarregar();
    } catch (err) {
      window.alert(err.message); // ex.: 409 com explicação
    }
  }

  return (
    <section>
      <div className="barra">
        <h2>Categorias</h2>
        <button type="button" onClick={() => abrir({})}>Nova categoria</button>
      </div>
      <Estado carregando={carregando} erro={erro} recarregar={recarregar}
        vazio={dados?.length === 0} textoVazio="Nenhuma categoria cadastrada.">
        <table>
          <thead><tr><th>Nome</th><th>Tipo</th><th /></tr></thead>
          <tbody>
            {dados?.map((c) => (
              <tr key={c.id}>
                <td>{c.nome}</td>
                <td className={c.tipo}>{ROTULO[c.tipo]}</td>
                <td className="acoes">
                  <button type="button" className="secundario" onClick={() => abrir(c)}>Editar</button>
                  <button type="button" className="perigo" onClick={() => excluir(c)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Estado>

      {editando && (
        <Modal titulo={editando.id ? 'Editar categoria' : 'Nova categoria'} aoFechar={() => setEditando(null)}>
          <form onSubmit={salvar} noValidate>
            {mensagem && <p className="erro-bloco" role="alert">{mensagem}</p>}
            <CampoForm id="nome" rotulo="Nome" erro={erros.nome}>
              <input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </CampoForm>
            <CampoForm id="tipo" rotulo="Tipo" erro={erros.tipo}>
              <select id="tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="saida">Saída</option>
                <option value="entrada">Entrada</option>
              </select>
            </CampoForm>
            <button type="submit">Salvar</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
```

`frontend/src/components/paginas/FontesDestinos.jsx`:
```jsx
import { useState } from 'react';
import { api } from '../../services/api.js';
import { useCarregar } from '../../utils/useCarregar.js';
import { moeda } from '../../utils/formatar.js';
import { mascararValor, numeroParaCampo, valorParaNumero } from '../../utils/mascaras.js';
import { Estado } from '../comuns/Estados.jsx';
import Modal from '../comuns/Modal.jsx';
import CampoForm from '../comuns/CampoForm.jsx';

const TIPOS = { renda: 'Renda', conta: 'Conta', cartao_credito: 'Cartão de crédito' };
const VAZIO = { nome: '', tipo: 'conta', diaFechamento: '', diaVencimento: '', limite: '', reserva: false };

export default function FontesDestinos() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/fontes-destinos'), []);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');

  function abrir(f) {
    setEditando(f);
    setForm(f.id ? {
      nome: f.nome, tipo: f.tipo, reserva: f.reserva,
      diaFechamento: f.diaFechamento ?? '', diaVencimento: f.diaVencimento ?? '',
      limite: f.limite != null ? numeroParaCampo(f.limite) : '',
    } : VAZIO);
    setErros({});
    setMensagem('');
  }

  async function salvar(e) {
    e.preventDefault();
    const cartao = form.tipo === 'cartao_credito';
    const corpo = {
      nome: form.nome, tipo: form.tipo, reserva: form.reserva,
      ...(cartao && {
        diaFechamento: Number(form.diaFechamento) || null,
        diaVencimento: Number(form.diaVencimento) || null,
        limite: form.limite ? valorParaNumero(form.limite) : null,
      }),
    };
    try {
      if (editando.id) await api.put(`/fontes-destinos/${editando.id}`, corpo);
      else await api.post('/fontes-destinos', corpo);
      setEditando(null);
      recarregar();
    } catch (err) {
      setErros(err.campos ?? {});
      setMensagem(err.message);
    }
  }

  async function excluir(f) {
    if (!window.confirm(`Excluir "${f.nome}"?`)) return;
    try {
      await api.delete(`/fontes-destinos/${f.id}`);
      recarregar();
    } catch (err) {
      window.alert(err.message);
    }
  }

  return (
    <section>
      <div className="barra">
        <h2>Fontes e destinos</h2>
        <button type="button" onClick={() => abrir({})}>Nova fonte/destino</button>
      </div>
      <Estado carregando={carregando} erro={erro} recarregar={recarregar}
        vazio={dados?.length === 0} textoVazio="Nenhuma fonte/destino cadastrada.">
        <table>
          <thead><tr><th>Nome</th><th>Tipo</th><th>Fecha / vence</th><th className="num">Limite</th><th /></tr></thead>
          <tbody>
            {dados?.map((f) => (
              <tr key={f.id}>
                <td>{f.nome}{f.reserva ? ' (reserva)' : ''}</td>
                <td>{TIPOS[f.tipo]}</td>
                <td>{f.tipo === 'cartao_credito' ? `dia ${f.diaFechamento} / dia ${f.diaVencimento}` : '—'}</td>
                <td className="num">{f.limite != null ? moeda(f.limite) : '—'}</td>
                <td className="acoes">
                  <button type="button" className="secundario" onClick={() => abrir(f)}>Editar</button>
                  <button type="button" className="perigo" onClick={() => excluir(f)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Estado>

      {editando && (
        <Modal titulo={editando.id ? 'Editar fonte/destino' : 'Nova fonte/destino'} aoFechar={() => setEditando(null)}>
          <form onSubmit={salvar} noValidate>
            {mensagem && <p className="erro-bloco" role="alert">{mensagem}</p>}
            <CampoForm id="nome" rotulo="Nome" erro={erros.nome}>
              <input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </CampoForm>
            <CampoForm id="tipo" rotulo="Tipo" erro={erros.tipo}>
              <select id="tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {Object.entries(TIPOS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </CampoForm>
            {form.tipo === 'cartao_credito' && (
              <>
                <CampoForm id="diaFechamento" rotulo="Dia de fechamento (1–31)" erro={erros.diaFechamento}>
                  <input id="diaFechamento" type="number" min="1" max="31" value={form.diaFechamento}
                    onChange={(e) => setForm({ ...form, diaFechamento: e.target.value })} />
                </CampoForm>
                <CampoForm id="diaVencimento" rotulo="Dia de vencimento (1–31)" erro={erros.diaVencimento}>
                  <input id="diaVencimento" type="number" min="1" max="31" value={form.diaVencimento}
                    onChange={(e) => setForm({ ...form, diaVencimento: e.target.value })} />
                </CampoForm>
                <CampoForm id="limite" rotulo="Limite (R$)" erro={erros.limite}>
                  <input id="limite" inputMode="numeric" value={form.limite}
                    onChange={(e) => setForm({ ...form, limite: mascararValor(e.target.value) })} />
                </CampoForm>
              </>
            )}
            {form.tipo === 'conta' && (
              <label>
                <input type="checkbox" style={{ width: 'auto' }} checked={form.reserva}
                  onChange={(e) => setForm({ ...form, reserva: e.target.checked })} />{' '}
                Conta de reserva de emergência
              </label>
            )}
            <p><button type="submit">Salvar</button></p>
          </form>
        </Modal>
      )}
    </section>
  );
}
```

Em `frontend/src/App.jsx`, importar as duas páginas e adicionar dentro de `<Route element={<RotaProtegida />}>`:
```jsx
<Route path="/categorias" element={<Categorias />} />
<Route path="/fontes-destinos" element={<FontesDestinos />} />
```

- [ ] **Step 8: Verificar no navegador**

Run: `cd frontend && npm run build` (sem erros). Com os dois servidores no ar: crie, edite e exclua uma categoria e uma fonte; crie um cartão e confira que, sem dia de fechamento/vencimento/limite, o erro aparece junto de cada campo; tente criar categoria duplicada e veja a mensagem no campo Nome.

- [ ] **Step 9: Checkpoint de commit**

```bash
git add backend/src backend/test frontend/src
git commit -m "feat: CRUD de categorias e fontes/destinos com regras de exclusão"
```

---

### Task 6: Lançamentos no back-end (CRUD, filtros, totais, parcelamento)

**Files:**
- Create: `backend/src/middlewares/validarLancamento.js`, `backend/src/models/lancamento.js`, `backend/src/routes/lancamentos.routes.js`
- Modify: `backend/src/server.js`
- Test: `backend/test/lancamentos.test.js`

**Interfaces:**
- Consumes: `criarValidador`, `texto`, `inteiroPositivo`, `valorMonetario`, `validarId`, `validarPeriodo` (preenche `req.periodo`), `ErroApi`, `naoEncontrado`, `Categoria.buscar`, `FonteDestino.buscar`, `transacao`, `dividirParcelas`, `arredondar`, `dataValida`.
- Produces:
  - `validarLancamento` (preenche `req.dados = {tipo, descricao, valor, data, categoriaId, fonteDestinoId, totalParcelas}`), `validarFiltrosLancamento` (preenche `req.filtros = {tipo|null, categoriaId|null, fonteDestinoId|null, pagina, limite}`).
  - `Lancamento.listar(usuarioId, {inicio, fim, tipo, categoriaId, fonteDestinoId, pagina, limite}) → {itens, totais:{entradas,saidas,saldo}, paginacao:{pagina,limite,total,paginas}}`; `buscar(usuarioId, id) → obj|null`; `criar(usuarioId, dados) → [obj]` (uma por parcela, em transação); `atualizar(usuarioId, id, dados) → obj|null`; `excluir(usuarioId, id, todasParcelas) → boolean`.
  - Objeto lançamento: `{id, tipo, descricao, valor, data, categoriaId, categoriaNome, fonteDestinoId, fonteDestinoNome, parcelaAtual, totalParcelas, grupoParcelamento}`.
  - Rotas `GET/POST /api/lancamentos`, `GET/PUT/DELETE /api/lancamentos/:id` (`?todasParcelas=true`). `POST` responde `201 { lancamentos: [...] }`.

- [ ] **Step 1: Testes (falham primeiro)**

`backend/test/lancamentos.test.js`:
```js
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar, encerrar, requisitar, pool, criarUsuario } from './helpers.js';
import { hojeISO } from '../src/models/datas.js';

let a;
let b;
let catSaida;
let catEntrada;
let conta;
let cartao;
const hoje = hojeISO();

const novo = (extra = {}) => ({
  tipo: 'saida', descricao: 'Mercado', valor: 100, data: hoje,
  categoriaId: catSaida.id, fonteDestinoId: conta.id, ...extra,
});
const criar = (corpo, token = a.token) => requisitar('POST', '/lancamentos', { token, corpo });

before(async () => {
  await iniciar();
  a = await criarUsuario('A');
  b = await criarUsuario('B');
  const cats = (await requisitar('GET', '/categorias', { token: a.token })).corpo;
  catSaida = cats.find((c) => c.tipo === 'saida');
  catEntrada = cats.find((c) => c.tipo === 'entrada');
  conta = (await requisitar('GET', '/fontes-destinos', { token: a.token })).corpo[0];
  cartao = (await requisitar('POST', '/fontes-destinos', {
    token: a.token, corpo: { nome: 'Nubank', tipo: 'cartao_credito', diaFechamento: 3, diaVencimento: 10, limite: 5000 },
  })).corpo;
});
after(encerrar);

test('exige token', async () => {
  assert.equal((await requisitar('GET', '/lancamentos')).status, 401);
});

test('cria saída simples', async () => {
  const r = await criar(novo());
  assert.equal(r.status, 201);
  assert.equal(r.corpo.lancamentos.length, 1);
  const l = r.corpo.lancamentos[0];
  assert.equal(l.valor, 100);
  assert.equal(l.parcelaAtual, 1);
  assert.equal(l.totalParcelas, 1);
  assert.equal(l.grupoParcelamento, null);
});

test('saída com categoria de entrada: 400 com mensagem do PDF', async () => {
  const r = await criar(novo({ categoriaId: catEntrada.id }));
  assert.equal(r.status, 400);
  assert.equal(r.corpo.campos.categoriaId, 'A categoria informada é de entrada, mas o lançamento é de saida.');
});

test('categoria ou fonte de outro usuário: 404', async () => {
  const catB = (await requisitar('GET', '/categorias', { token: b.token })).corpo.find((c) => c.tipo === 'saida');
  assert.equal((await criar(novo({ categoriaId: catB.id }))).status, 404);
  const fonteB = (await requisitar('GET', '/fontes-destinos', { token: b.token })).corpo[0];
  assert.equal((await criar(novo({ fonteDestinoId: fonteB.id }))).status, 404);
});

test('Review Focus 3: valores inválidos dão 400 no campo valor', async () => {
  for (const valor of [0, -5, '10,5', 1.005, 'abc', null, 1e15, undefined]) {
    const r = await criar(novo({ valor }));
    assert.equal(r.status, 400, String(valor));
    assert.ok(r.corpo.campos.valor, String(valor));
  }
  assert.equal((await criar(novo({ valor: '12.50' }))).status, 201);
});

test('Review Focus 4: data impossível e demais campos obrigatórios: 400', async () => {
  for (const data of ['2026-02-30', '30/02/2026', '', undefined, 20260101]) {
    const r = await criar(novo({ data }));
    assert.equal(r.status, 400, String(data));
    assert.ok(r.corpo.campos.data);
  }
  const r = await criar({});
  assert.equal(r.status, 400);
  for (const c of ['tipo', 'descricao', 'valor', 'data', 'categoriaId', 'fonteDestinoId']) assert.ok(r.corpo.campos[c], c);
  assert.equal((await requisitar('POST', '/lancamentos', { token: a.token })).status, 400);
});

test('compra parcelada: R$ 100,00 em 3x soma exatamente 100,00, mesmo grupo', async () => {
  const r = await criar(novo({ descricao: 'Compra', fonteDestinoId: cartao.id, totalParcelas: 3 }));
  assert.equal(r.status, 201);
  const ls = r.corpo.lancamentos;
  assert.deepEqual(ls.map((l) => l.valor), [33.34, 33.33, 33.33]);
  assert.deepEqual(ls.map((l) => l.parcelaAtual), [1, 2, 3]);
  assert.equal(new Set(ls.map((l) => l.grupoParcelamento)).size, 1);
  assert.ok(ls[0].grupoParcelamento);
  assert.ok(ls.every((l) => l.data === hoje));
});

test('parcelas só valem para saída no cartão; limite de 1 a 48', async () => {
  const naConta = await criar(novo({ totalParcelas: 3 }));
  assert.equal(naConta.status, 400);
  assert.ok(naConta.corpo.campos.totalParcelas);
  const entrada = await criar(novo({ tipo: 'entrada', categoriaId: catEntrada.id, fonteDestinoId: cartao.id, totalParcelas: 2 }));
  assert.equal(entrada.status, 400);
  for (const n of [0, 49, 1.5, 'x']) {
    const r = await criar(novo({ fonteDestinoId: cartao.id, totalParcelas: n }));
    assert.equal(r.status, 400, String(n));
  }
  assert.equal((await criar(novo({ fonteDestinoId: cartao.id, totalParcelas: 48 }))).status, 201);
});

test('parcelas são gravadas em transação: falha na 3ª não deixa nenhuma', async () => {
  const antes = (await pool.query('SELECT COUNT(*)::int AS n FROM lancamentos')).rows[0].n;
  await pool.query(`CREATE OR REPLACE FUNCTION falha_na_3() RETURNS trigger AS $$
    BEGIN IF NEW.parcela_atual = 3 THEN RAISE EXCEPTION 'falha simulada'; END IF; RETURN NEW; END;
    $$ LANGUAGE plpgsql`);
  await pool.query('CREATE TRIGGER t_falha BEFORE INSERT ON lancamentos FOR EACH ROW EXECUTE FUNCTION falha_na_3()');
  try {
    const r = await criar(novo({ fonteDestinoId: cartao.id, totalParcelas: 3, descricao: 'Vai falhar' }));
    assert.equal(r.status, 500);
    assert.equal(r.corpo.erro, 'Erro interno do servidor.');
    const depois = (await pool.query('SELECT COUNT(*)::int AS n FROM lancamentos')).rows[0].n;
    assert.equal(depois, antes);
  } finally {
    await pool.query('DROP TRIGGER t_falha ON lancamentos');
    await pool.query('DROP FUNCTION falha_na_3()');
  }
});

test('listagem: padrão é o mês corrente, com totais, filtros e paginação', async () => {
  await pool.query('DELETE FROM lancamentos WHERE usuario_id = $1', [a.id]);
  await criar(novo({ descricao: 'S1', valor: 50 }));
  await criar(novo({ descricao: 'S2', valor: 25.5 }));
  await criar(novo({ descricao: 'E1', tipo: 'entrada', categoriaId: catEntrada.id, valor: 1000 }));
  await criar(novo({ descricao: 'Antigo', data: '2020-01-15', valor: 7 }));

  const todos = await requisitar('GET', '/lancamentos', { token: a.token });
  assert.equal(todos.status, 200);
  assert.equal(todos.corpo.itens.length, 3);
  assert.deepEqual(todos.corpo.totais, { entradas: 1000, saidas: 75.5, saldo: 924.5 });
  assert.equal(todos.corpo.paginacao.total, 3);
  assert.ok(todos.corpo.itens[0].categoriaNome && todos.corpo.itens[0].fonteDestinoNome);

  const saidas = await requisitar('GET', '/lancamentos?tipo=saida', { token: a.token });
  assert.equal(saidas.corpo.itens.length, 2);

  const antigo = await requisitar('GET', '/lancamentos?inicio=2020-01-01&fim=2020-01-31', { token: a.token });
  assert.equal(antigo.corpo.itens.length, 1);
  assert.equal(antigo.corpo.itens[0].descricao, 'Antigo');

  const pag2 = await requisitar('GET', '/lancamentos?limite=2&pagina=2', { token: a.token });
  assert.equal(pag2.corpo.itens.length, 1);
  assert.equal(pag2.corpo.paginacao.paginas, 2);
  assert.equal(pag2.corpo.totais.saldo, 924.5); // totais são do período, não da página

  const porCat = await requisitar('GET', `/lancamentos?categoriaId=${catEntrada.id}`, { token: a.token });
  assert.equal(porCat.corpo.itens.length, 1);
});

test('Review Focus 4: filtros e paginação inválidos dão 400', async () => {
  for (const q of ['pagina=0', 'pagina=abc', 'limite=0', 'limite=1000', 'inicio=x', 'fim=2026-02-30',
    'inicio=2026-02-10&fim=2026-02-01', 'tipo=outro', 'categoriaId=abc']) {
    const r = await requisitar('GET', `/lancamentos?${q}`, { token: a.token });
    assert.equal(r.status, 400, q);
    assert.ok(r.corpo.campos, q);
  }
});

test('edição e exclusão de lançamento simples', async () => {
  const id = (await criar(novo({ descricao: 'Editar' }))).corpo.lancamentos[0].id;
  const get = await requisitar('GET', `/lancamentos/${id}`, { token: a.token });
  assert.equal(get.status, 200);
  const put = await requisitar('PUT', `/lancamentos/${id}`, { token: a.token, corpo: novo({ descricao: 'Editado', valor: 12.34 }) });
  assert.equal(put.status, 200);
  assert.equal(put.corpo.descricao, 'Editado');
  assert.equal(put.corpo.valor, 12.34);
  const invalido = await requisitar('PUT', `/lancamentos/${id}`, { token: a.token, corpo: novo({ categoriaId: catEntrada.id }) });
  assert.equal(invalido.status, 400);
  assert.equal((await requisitar('DELETE', `/lancamentos/${id}`, { token: a.token })).status, 204);
  assert.equal((await requisitar('GET', `/lancamentos/${id}`, { token: a.token })).status, 404);
});

test('exclusão de parcela: só esta ou todas', async () => {
  const mk = async () => (await criar(novo({ fonteDestinoId: cartao.id, totalParcelas: 3 }))).corpo.lancamentos;
  const g1 = await mk();
  assert.equal((await requisitar('DELETE', `/lancamentos/${g1[1].id}`, { token: a.token })).status, 204);
  const restantes = await pool.query('SELECT id FROM lancamentos WHERE grupo_parcelamento = $1', [g1[0].grupoParcelamento]);
  assert.equal(restantes.rowCount, 2);

  const g2 = await mk();
  assert.equal((await requisitar('DELETE', `/lancamentos/${g2[0].id}?todasParcelas=true`, { token: a.token })).status, 204);
  const zero = await pool.query('SELECT id FROM lancamentos WHERE grupo_parcelamento = $1', [g2[0].grupoParcelamento]);
  assert.equal(zero.rowCount, 0);
});

test('parcela de compra parcelada não troca de cartão nem de tipo na edição', async () => {
  const ls = (await criar(novo({ fonteDestinoId: cartao.id, totalParcelas: 2 }))).corpo.lancamentos;
  const r = await requisitar('PUT', `/lancamentos/${ls[0].id}`, { token: a.token, corpo: novo({ fonteDestinoId: conta.id }) });
  assert.equal(r.status, 400);
  assert.ok(r.corpo.campos.fonteDestinoId);
  const ok = await requisitar('PUT', `/lancamentos/${ls[0].id}`, {
    token: a.token, corpo: novo({ fonteDestinoId: cartao.id, descricao: 'Nova descrição', valor: 40 }),
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.corpo.totalParcelas, 2);
});

test('isolamento: B não lê, edita nem exclui lançamento de A (404), e id inválido é 404', async () => {
  const id = (await criar(novo({ descricao: 'Do A' }))).corpo.lancamentos[0].id;
  assert.equal((await requisitar('GET', `/lancamentos/${id}`, { token: b.token })).status, 404);
  const catB = (await requisitar('GET', '/categorias', { token: b.token })).corpo.find((c) => c.tipo === 'saida');
  const fonteB = (await requisitar('GET', '/fontes-destinos', { token: b.token })).corpo[0];
  const corpoB = novo({ categoriaId: catB.id, fonteDestinoId: fonteB.id });
  assert.equal((await requisitar('PUT', `/lancamentos/${id}`, { token: b.token, corpo: corpoB })).status, 404);
  assert.equal((await requisitar('DELETE', `/lancamentos/${id}`, { token: b.token })).status, 404);
  assert.equal((await requisitar('GET', `/lancamentos/${id}`, { token: a.token })).status, 200);
  const listaB = await requisitar('GET', '/lancamentos?inicio=2000-01-01&fim=2100-01-01', { token: b.token });
  assert.equal(listaB.corpo.itens.length, 0);
  assert.equal((await requisitar('GET', '/lancamentos/abc', { token: a.token })).status, 404);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && node --test test/lancamentos.test.js`
Expected: FAIL (rota `/api/lancamentos` não existe → 404).

- [ ] **Step 3: Validadores**

`backend/src/middlewares/validarLancamento.js`:
```js
import { ErroApi } from './erros.js';
import { criarValidador, texto, inteiroPositivo, valorMonetario } from './validar.js';
import { dataValida } from '../models/datas.js';

export const validarLancamento = criarValidador((b, campos) => {
  const tipo = b.tipo;
  const descricao = texto(b.descricao);
  const valor = valorMonetario(b.valor);
  const data = b.data;
  const categoriaId = inteiroPositivo(b.categoriaId);
  const fonteDestinoId = inteiroPositivo(b.fonteDestinoId);
  let totalParcelas = 1;

  if (!['entrada', 'saida'].includes(tipo)) campos.tipo = 'Informe o tipo: entrada ou saida.';
  if (!descricao) campos.descricao = 'Informe a descrição.';
  else if (descricao.length > 120) campos.descricao = 'A descrição deve ter no máximo 120 caracteres.';
  if (valor === null) campos.valor = 'O valor deve ser maior que zero, com até 2 casas decimais.';
  if (!dataValida(data)) campos.data = 'Informe uma data válida (AAAA-MM-DD).';
  if (categoriaId === null) campos.categoriaId = 'Informe a categoria.';
  if (fonteDestinoId === null) campos.fonteDestinoId = 'Informe a fonte/destino.';
  if (b.totalParcelas !== undefined && b.totalParcelas !== null) {
    const n = inteiroPositivo(b.totalParcelas);
    if (n === null || n > 48) campos.totalParcelas = 'O número de parcelas deve ser de 1 a 48.';
    else totalParcelas = n;
  }
  return { tipo, descricao, valor, data, categoriaId, fonteDestinoId, totalParcelas };
});

// Filtros da listagem (o período vem de validarPeriodo, que roda antes)
export function validarFiltrosLancamento(req, res, next) {
  const q = req.query;
  const campos = {};
  const um = (v) => (typeof v === 'string' ? v : undefined);

  let tipo = null;
  if (q.tipo !== undefined) {
    if (['entrada', 'saida'].includes(um(q.tipo))) tipo = q.tipo;
    else campos.tipo = 'Tipo inválido. Use entrada ou saida.';
  }
  const idOpcional = (nome) => {
    if (q[nome] === undefined || q[nome] === '') return null;
    const n = inteiroPositivo(um(q[nome]));
    if (n === null) campos[nome] = 'Informe um número válido.';
    return n;
  };
  const categoriaId = idOpcional('categoriaId');
  const fonteDestinoId = idOpcional('fonteDestinoId');

  let pagina = 1;
  if (q.pagina !== undefined) {
    pagina = inteiroPositivo(um(q.pagina));
    if (pagina === null) { campos.pagina = 'A página deve ser um inteiro a partir de 1.'; pagina = 1; }
  }
  let limite = 20;
  if (q.limite !== undefined) {
    limite = inteiroPositivo(um(q.limite));
    if (limite === null || limite > 100) { campos.limite = 'O limite deve ser de 1 a 100.'; limite = 20; }
  }

  if (Object.keys(campos).length > 0) return next(new ErroApi(400, 'Filtros inválidos.', campos));
  req.filtros = { tipo, categoriaId, fonteDestinoId, pagina, limite };
  return next();
}
```

- [ ] **Step 4: Model**

`backend/src/models/lancamento.js`:
```js
import { randomUUID } from 'node:crypto';
import { pool, transacao } from '../config/db.js';
import { arredondar, dividirParcelas } from './dinheiro.js';

const mapa = (r) => ({
  id: r.id,
  tipo: r.tipo,
  descricao: r.descricao,
  valor: r.valor,
  data: r.data,
  categoriaId: r.categoria_id,
  categoriaNome: r.categoria_nome,
  fonteDestinoId: r.fonte_destino_id,
  fonteDestinoNome: r.fonte_destino_nome,
  parcelaAtual: r.parcela_atual,
  totalParcelas: r.total_parcelas,
  grupoParcelamento: r.grupo_parcelamento,
});

const SELECT = `SELECT l.*, c.nome AS categoria_nome, f.nome AS fonte_destino_nome
                  FROM lancamentos l
                  JOIN categorias c ON c.id = l.categoria_id
                  JOIN fontes_destinos f ON f.id = l.fonte_destino_id`;

function filtrar(usuarioId, f) {
  const condicoes = ['l.usuario_id = $1', 'l.data BETWEEN $2 AND $3'];
  const params = [usuarioId, f.inicio, f.fim];
  for (const [campo, coluna] of [['tipo', 'l.tipo'], ['categoriaId', 'l.categoria_id'], ['fonteDestinoId', 'l.fonte_destino_id']]) {
    if (f[campo] != null) {
      params.push(f[campo]);
      condicoes.push(`${coluna} = $${params.length}`);
    }
  }
  return { where: condicoes.join(' AND '), params };
}

export async function listar(usuarioId, f) {
  const { where, params } = filtrar(usuarioId, f);
  const resumo = await pool.query(
    `SELECT COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'), 0) AS entradas,
            COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'), 0) AS saidas,
            COUNT(*)::int AS total
       FROM lancamentos l WHERE ${where}`, params);
  const { entradas, saidas, total } = resumo.rows[0];

  const n = params.length;
  const { rows } = await pool.query(
    `${SELECT} WHERE ${where} ORDER BY l.data DESC, l.id DESC LIMIT $${n + 1} OFFSET $${n + 2}`,
    [...params, f.limite, (f.pagina - 1) * f.limite]);

  return {
    itens: rows.map(mapa),
    totais: { entradas, saidas, saldo: arredondar(entradas - saidas) },
    paginacao: { pagina: f.pagina, limite: f.limite, total, paginas: Math.max(1, Math.ceil(total / f.limite)) },
  };
}

export async function buscar(usuarioId, id) {
  const { rows } = await pool.query(`${SELECT} WHERE l.id = $1 AND l.usuario_id = $2`, [id, usuarioId]);
  return rows[0] ? mapa(rows[0]) : null;
}

// Uma linha por parcela, todas na mesma transação (todas gravadas ou nenhuma).
export async function criar(usuarioId, d) {
  const valores = dividirParcelas(d.valor, d.totalParcelas);
  const grupo = d.totalParcelas > 1 ? randomUUID() : null;
  return transacao(async (client) => {
    const criados = [];
    for (let i = 0; i < valores.length; i += 1) {
      const { rows } = await client.query(
        `INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id,
                                  parcela_atual, total_parcelas, grupo_parcelamento)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [usuarioId, d.tipo, d.descricao, valores[i], d.data, d.categoriaId, d.fonteDestinoId,
          i + 1, d.totalParcelas, grupo]);
      criados.push(mapa(rows[0]));
    }
    return criados;
  });
}

export async function atualizar(usuarioId, id, d) {
  const { rowCount } = await pool.query(
    `UPDATE lancamentos
        SET tipo = $3, descricao = $4, valor = $5, data = $6, categoria_id = $7, fonte_destino_id = $8
      WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId, d.tipo, d.descricao, d.valor, d.data, d.categoriaId, d.fonteDestinoId]);
  return rowCount > 0 ? buscar(usuarioId, id) : null;
}

export async function excluir(usuarioId, id, todasParcelas) {
  const l = await buscar(usuarioId, id);
  if (!l) return false;
  if (todasParcelas && l.grupoParcelamento) {
    await pool.query('DELETE FROM lancamentos WHERE usuario_id = $1 AND grupo_parcelamento = $2',
      [usuarioId, l.grupoParcelamento]);
  } else {
    await pool.query('DELETE FROM lancamentos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  }
  return true;
}
```

- [ ] **Step 5: Rotas**

`backend/src/routes/lancamentos.routes.js`:
```js
import { Router } from 'express';
import { ErroApi, naoEncontrado } from '../middlewares/erros.js';
import { validarId, validarPeriodo } from '../middlewares/validar.js';
import { validarFiltrosLancamento, validarLancamento } from '../middlewares/validarLancamento.js';
import * as Lancamento from '../models/lancamento.js';
import * as Categoria from '../models/categoria.js';
import * as FonteDestino from '../models/fonteDestino.js';

const router = Router();
router.param('id', validarId);

// Regras que dependem do banco: posse, tipo da categoria e parcelamento.
async function verificarReferencias(usuarioId, d) {
  const categoria = await Categoria.buscar(usuarioId, d.categoriaId);
  if (!categoria) {
    throw new ErroApi(404, 'Categoria não encontrada.', { categoriaId: 'A categoria informada não existe.' });
  }
  const fonte = await FonteDestino.buscar(usuarioId, d.fonteDestinoId);
  if (!fonte) {
    throw new ErroApi(404, 'Fonte/destino não encontrada.', { fonteDestinoId: 'A fonte/destino informada não existe.' });
  }
  if (categoria.tipo !== d.tipo) {
    throw new ErroApi(400, 'Dados inválidos.', {
      categoriaId: `A categoria informada é de ${categoria.tipo}, mas o lançamento é de ${d.tipo}.`,
    });
  }
  if (d.totalParcelas > 1 && !(d.tipo === 'saida' && fonte.tipo === 'cartao_credito')) {
    throw new ErroApi(400, 'Dados inválidos.', {
      totalParcelas: 'Somente compras (saídas) no cartão de crédito podem ser parceladas.',
    });
  }
  return fonte;
}

router.get('/', validarPeriodo, validarFiltrosLancamento, async (req, res) => {
  res.json(await Lancamento.listar(req.usuarioId, { ...req.periodo, ...req.filtros }));
});

router.post('/', validarLancamento, async (req, res) => {
  await verificarReferencias(req.usuarioId, req.dados);
  const lancamentos = await Lancamento.criar(req.usuarioId, req.dados);
  res.status(201).json({ lancamentos });
});

router.get('/:id', async (req, res) => {
  const l = await Lancamento.buscar(req.usuarioId, Number(req.params.id));
  if (!l) throw naoEncontrado('Lançamento não encontrado.');
  res.json(l);
});

// A edição altera somente a linha informada (cada parcela é um lançamento).
router.put('/:id', validarLancamento, async (req, res) => {
  const id = Number(req.params.id);
  const atual = await Lancamento.buscar(req.usuarioId, id);
  if (!atual) throw naoEncontrado('Lançamento não encontrado.');
  const dados = { ...req.dados, totalParcelas: 1 };
  await verificarReferencias(req.usuarioId, dados);
  if (atual.totalParcelas > 1 && (dados.tipo !== atual.tipo || dados.fonteDestinoId !== atual.fonteDestinoId)) {
    throw new ErroApi(400, 'Dados inválidos.', {
      fonteDestinoId: 'Parcelas de uma compra parcelada não podem mudar de tipo nem de cartão.',
    });
  }
  res.json(await Lancamento.atualizar(req.usuarioId, id, dados));
});

router.delete('/:id', async (req, res) => {
  const achou = await Lancamento.excluir(req.usuarioId, Number(req.params.id), req.query.todasParcelas === 'true');
  if (!achou) throw naoEncontrado('Lançamento não encontrado.');
  res.status(204).end();
});

export default router;
```

Em `backend/src/server.js`, adicionar:
```js
import lancamentosRoutes from './routes/lancamentos.routes.js';
```
```js
app.use('/api/lancamentos', autenticar, lancamentosRoutes);
```

- [ ] **Step 6: Rodar os testes**

Run: `cd backend && node --test test/lancamentos.test.js`
Expected: PASS em todos. Depois `npm test` completo: PASS.

- [ ] **Step 7: Checkpoint de commit**

```bash
git add backend/src backend/test
git commit -m "feat: CRUD de lançamentos com filtros, totais, paginação e parcelamento transacional"
```

---

### Task 7: Lançamentos e dashboard no front-end

**Files:**
- Create: `frontend/src/components/comuns/Paginacao.jsx`, `frontend/src/components/comuns/ModalConfirmar.jsx`, `frontend/src/components/paginas/Lancamentos.jsx`, `frontend/src/components/paginas/FormLancamento.jsx`
- Modify: `frontend/src/components/paginas/Dashboard.jsx`, `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /api/lancamentos`, `GET /api/categorias`, `GET /api/fontes-destinos` (Tasks 5 e 6); `useCarregar`, `Estado`, `Modal`, `CampoForm`, máscaras e formatadores (Task 4).
- Produces: `<Paginacao pagina paginas aoMudar />`, `<ModalConfirmar titulo aoFechar>{opções}</ModalConfirmar>`, `<FormLancamento lancamento categorias fontes aoSalvar aoCancelar />`, página `Lancamentos`, página `Dashboard`.

- [ ] **Step 1: Componentes comuns**

`frontend/src/components/comuns/Paginacao.jsx`:
```jsx
export default function Paginacao({ pagina, paginas, aoMudar }) {
  if (paginas <= 1) return null;
  return (
    <div className="barra" style={{ justifyContent: 'center', marginTop: '1rem' }}>
      <button type="button" className="secundario" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>Anterior</button>
      <span>Página {pagina} de {paginas}</span>
      <button type="button" className="secundario" disabled={pagina >= paginas} onClick={() => aoMudar(pagina + 1)}>Próxima</button>
    </div>
  );
}
```

`frontend/src/components/comuns/ModalConfirmar.jsx`:
```jsx
import Modal from './Modal.jsx';

// children = botões de ação; o botão "Cancelar" é padrão
export default function ModalConfirmar({ titulo, mensagem, aoFechar, children }) {
  return (
    <Modal titulo={titulo} aoFechar={aoFechar}>
      <p>{mensagem}</p>
      <div className="acoes">
        {children}
        <button type="button" className="secundario" onClick={aoFechar}>Cancelar</button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Formulário de lançamento**

`frontend/src/components/paginas/FormLancamento.jsx`:
```jsx
import { useState } from 'react';
import { api } from '../../services/api.js';
import { hojeISO } from '../../utils/formatar.js';
import { mascararValor, numeroParaCampo, valorParaNumero } from '../../utils/mascaras.js';
import CampoForm from '../comuns/CampoForm.jsx';

export default function FormLancamento({ lancamento, categorias, fontes, aoSalvar, aoCancelar }) {
  const edicao = Boolean(lancamento?.id);
  const [form, setForm] = useState(() => edicao ? {
    tipo: lancamento.tipo, descricao: lancamento.descricao, valor: numeroParaCampo(lancamento.valor),
    data: lancamento.data, categoriaId: String(lancamento.categoriaId),
    fonteDestinoId: String(lancamento.fonteDestinoId), totalParcelas: '1',
  } : {
    tipo: 'saida', descricao: '', valor: '', data: hojeISO(), categoriaId: '', fonteDestinoId: '', totalParcelas: '1',
  });
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  const fonte = fontes.find((f) => String(f.id) === form.fonteDestinoId);
  const podeParcelar = !edicao && form.tipo === 'saida' && fonte?.tipo === 'cartao_credito';
  const categoriasDoTipo = categorias.filter((c) => c.tipo === form.tipo);
  const mudar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setMensagem('');
    const corpo = {
      tipo: form.tipo,
      descricao: form.descricao,
      valor: form.valor ? valorParaNumero(form.valor) : null,
      data: form.data,
      categoriaId: Number(form.categoriaId) || null,
      fonteDestinoId: Number(form.fonteDestinoId) || null,
      ...(podeParcelar && { totalParcelas: Number(form.totalParcelas) || 1 }),
    };
    setEnviando(true);
    try {
      if (edicao) await api.put(`/lancamentos/${lancamento.id}`, corpo);
      else await api.post('/lancamentos', corpo);
      aoSalvar();
    } catch (erro) {
      setErros(erro.campos ?? {});
      setMensagem(erro.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      {mensagem && <p className="erro-bloco" role="alert">{mensagem}</p>}
      <CampoForm id="tipo" rotulo="Tipo" erro={erros.tipo}>
        <select id="tipo" value={form.tipo} disabled={edicao && lancamento.totalParcelas > 1}
          onChange={(e) => setForm({ ...form, tipo: e.target.value, categoriaId: '' })}>
          <option value="saida">Saída</option>
          <option value="entrada">Entrada</option>
        </select>
      </CampoForm>
      <CampoForm id="descricao" rotulo="Descrição" erro={erros.descricao}>
        <input id="descricao" value={form.descricao} onChange={mudar('descricao')} />
      </CampoForm>
      <CampoForm id="valor" rotulo="Valor (R$)" erro={erros.valor}>
        <input id="valor" inputMode="numeric" value={form.valor}
          onChange={(e) => setForm({ ...form, valor: mascararValor(e.target.value) })} />
      </CampoForm>
      <CampoForm id="data" rotulo="Data" erro={erros.data}>
        <input id="data" type="date" value={form.data} onChange={mudar('data')} />
      </CampoForm>
      <CampoForm id="categoriaId" rotulo="Categoria" erro={erros.categoriaId}>
        <select id="categoriaId" value={form.categoriaId} onChange={mudar('categoriaId')}>
          <option value="">Selecione…</option>
          {categoriasDoTipo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </CampoForm>
      <CampoForm id="fonteDestinoId" rotulo={form.tipo === 'entrada' ? 'Fonte' : 'Destino'} erro={erros.fonteDestinoId}>
        <select id="fonteDestinoId" value={form.fonteDestinoId} disabled={edicao && lancamento.totalParcelas > 1}
          onChange={mudar('fonteDestinoId')}>
          <option value="">Selecione…</option>
          {fontes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </CampoForm>
      {podeParcelar && (
        <CampoForm id="totalParcelas" rotulo="Parcelas (1 a 48)" erro={erros.totalParcelas}>
          <input id="totalParcelas" type="number" min="1" max="48" value={form.totalParcelas} onChange={mudar('totalParcelas')} />
        </CampoForm>
      )}
      {edicao && lancamento.totalParcelas > 1 && (
        <p className="estado">A edição altera apenas a parcela {lancamento.parcelaAtual}/{lancamento.totalParcelas}.</p>
      )}
      <div className="acoes">
        <button type="submit" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button>
        <button type="button" className="secundario" onClick={aoCancelar}>Cancelar</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Página de lançamentos**

`frontend/src/components/paginas/Lancamentos.jsx`:
```jsx
import { useState } from 'react';
import { api } from '../../services/api.js';
import { useCarregar } from '../../utils/useCarregar.js';
import { dataBR, mesAtual, moeda } from '../../utils/formatar.js';
import { Estado } from '../comuns/Estados.jsx';
import Modal from '../comuns/Modal.jsx';
import ModalConfirmar from '../comuns/ModalConfirmar.jsx';
import Paginacao from '../comuns/Paginacao.jsx';
import CampoForm from '../comuns/CampoForm.jsx';
import FormLancamento from './FormLancamento.jsx';

export default function Lancamentos() {
  const [filtros, setFiltros] = useState({ ...mesAtual(), tipo: '', categoriaId: '', fonteDestinoId: '', pagina: 1 });
  const [editando, setEditando] = useState(null); // null fechado; {} novo; objeto = edição
  const [excluindo, setExcluindo] = useState(null);
  const [erroAcao, setErroAcao] = useState('');

  const refs = useCarregar(async () => {
    const [categorias, fontes] = await Promise.all([api.get('/categorias'), api.get('/fontes-destinos')]);
    return { categorias, fontes };
  }, []);

  const consulta = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== '')).toString();
  const lista = useCarregar(() => api.get(`/lancamentos?${consulta}`), [consulta]);

  const mudar = (campo) => (e) => setFiltros({ ...filtros, [campo]: e.target.value, pagina: 1 });

  async function excluir(todasParcelas) {
    try {
      await api.delete(`/lancamentos/${excluindo.id}${todasParcelas ? '?todasParcelas=true' : ''}`);
      setExcluindo(null);
      lista.recarregar();
    } catch (e) {
      setErroAcao(e.message);
      setExcluindo(null);
    }
  }

  const { itens = [], totais, paginacao } = lista.dados ?? {};

  return (
    <section>
      <div className="barra">
        <h2>Lançamentos</h2>
        <button type="button" disabled={!refs.dados} onClick={() => setEditando({})}>Novo lançamento</button>
      </div>
      {erroAcao && <p className="erro-bloco" role="alert">{erroAcao}</p>}

      <div className="barra">
        <CampoForm id="f-inicio" rotulo="De"><input id="f-inicio" type="date" value={filtros.inicio} onChange={mudar('inicio')} /></CampoForm>
        <CampoForm id="f-fim" rotulo="Até"><input id="f-fim" type="date" value={filtros.fim} onChange={mudar('fim')} /></CampoForm>
        <CampoForm id="f-tipo" rotulo="Tipo">
          <select id="f-tipo" value={filtros.tipo} onChange={mudar('tipo')}>
            <option value="">Todos</option><option value="entrada">Entrada</option><option value="saida">Saída</option>
          </select>
        </CampoForm>
        <CampoForm id="f-cat" rotulo="Categoria">
          <select id="f-cat" value={filtros.categoriaId} onChange={mudar('categoriaId')}>
            <option value="">Todas</option>
            {refs.dados?.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.tipo === 'entrada' ? 'E' : 'S'})</option>)}
          </select>
        </CampoForm>
        <CampoForm id="f-fonte" rotulo="Fonte/destino">
          <select id="f-fonte" value={filtros.fonteDestinoId} onChange={mudar('fonteDestinoId')}>
            <option value="">Todas</option>
            {refs.dados?.fontes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </CampoForm>
      </div>

      {totais && (
        <div className="cards">
          <div className="card"><small>Entradas</small><strong className="entrada">{moeda(totais.entradas)}</strong></div>
          <div className="card"><small>Saídas</small><strong className="saida">{moeda(totais.saidas)}</strong></div>
          <div className="card"><small>Saldo</small><strong className={totais.saldo >= 0 ? 'entrada' : 'saida'}>{moeda(totais.saldo)}</strong></div>
        </div>
      )}

      <Estado carregando={lista.carregando} erro={lista.erro} recarregar={lista.recarregar}
        vazio={itens.length === 0} textoVazio="Nenhum lançamento no período.">
        <table>
          <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Fonte/destino</th><th className="num">Valor</th><th /></tr></thead>
          <tbody>
            {itens.map((l) => (
              <tr key={l.id}>
                <td>{dataBR(l.data)}</td>
                <td>{l.descricao}{l.totalParcelas > 1 ? ` — ${l.parcelaAtual}/${l.totalParcelas}` : ''}</td>
                <td>{l.categoriaNome}</td>
                <td>{l.fonteDestinoNome}</td>
                <td className={`num ${l.tipo}`}>{l.tipo === 'saida' ? '−' : '+'} {moeda(l.valor)}</td>
                <td className="acoes">
                  <button type="button" className="secundario" onClick={() => setEditando(l)}>Editar</button>
                  <button type="button" className="perigo" onClick={() => setExcluindo(l)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {paginacao && (
          <Paginacao pagina={paginacao.pagina} paginas={paginacao.paginas}
            aoMudar={(p) => setFiltros({ ...filtros, pagina: p })} />
        )}
      </Estado>

      {editando && refs.dados && (
        <Modal titulo={editando.id ? 'Editar lançamento' : 'Novo lançamento'} aoFechar={() => setEditando(null)}>
          <FormLancamento lancamento={editando} categorias={refs.dados.categorias} fontes={refs.dados.fontes}
            aoCancelar={() => setEditando(null)}
            aoSalvar={() => { setEditando(null); setErroAcao(''); lista.recarregar(); }} />
        </Modal>
      )}

      {excluindo && (
        <ModalConfirmar titulo="Excluir lançamento" aoFechar={() => setExcluindo(null)}
          mensagem={excluindo.totalParcelas > 1
            ? `"${excluindo.descricao}" é parcela ${excluindo.parcelaAtual}/${excluindo.totalParcelas}. Excluir apenas esta ou todas as parcelas da compra?`
            : `Excluir "${excluindo.descricao}" (${moeda(excluindo.valor)})?`}>
          {excluindo.totalParcelas > 1 ? (
            <>
              <button type="button" className="perigo" onClick={() => excluir(false)}>Só esta</button>
              <button type="button" className="perigo" onClick={() => excluir(true)}>Todas as parcelas</button>
            </>
          ) : (
            <button type="button" className="perigo" onClick={() => excluir(false)}>Excluir</button>
          )}
        </ModalConfirmar>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Dashboard**

Substituir `frontend/src/components/paginas/Dashboard.jsx` por:
```jsx
import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useCarregar } from '../../utils/useCarregar.js';
import { dataBR, mesAtual, mesExtenso, moeda } from '../../utils/formatar.js';
import { Estado } from '../comuns/Estados.jsx';

export default function Dashboard() {
  const { usuario } = useAuth();
  const { inicio, fim } = mesAtual();
  const { dados, carregando, erro, recarregar } = useCarregar(
    () => api.get(`/lancamentos?inicio=${inicio}&fim=${fim}&limite=5`), [inicio, fim]);

  return (
    <section>
      <h2>Olá, {usuario?.nome}</h2>
      <p>Resumo de {mesExtenso(inicio.slice(0, 7))}</p>
      <Estado carregando={carregando} erro={erro} recarregar={recarregar}>
        {dados && (
          <>
            <div className="cards">
              <div className="card"><small>Entradas</small><strong className="entrada">{moeda(dados.totais.entradas)}</strong></div>
              <div className="card"><small>Saídas</small><strong className="saida">{moeda(dados.totais.saidas)}</strong></div>
              <div className="card"><small>Saldo</small>
                <strong className={dados.totais.saldo >= 0 ? 'entrada' : 'saida'}>{moeda(dados.totais.saldo)}</strong></div>
            </div>
            <h3>Últimos lançamentos</h3>
            {dados.itens.length === 0 ? (
              <p className="estado">Nenhum lançamento neste mês. <Link to="/lancamentos">Adicionar</Link></p>
            ) : (
              <table>
                <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="num">Valor</th></tr></thead>
                <tbody>
                  {dados.itens.map((l) => (
                    <tr key={l.id}>
                      <td>{dataBR(l.data)}</td>
                      <td>{l.descricao}{l.totalParcelas > 1 ? ` — ${l.parcelaAtual}/${l.totalParcelas}` : ''}</td>
                      <td>{l.categoriaNome}</td>
                      <td className={`num ${l.tipo}`}>{l.tipo === 'saida' ? '−' : '+'} {moeda(l.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p><Link to="/lancamentos">Ver todos os lançamentos</Link></p>
          </>
        )}
      </Estado>
    </section>
  );
}
```

- [ ] **Step 5: Rota**

Em `frontend/src/App.jsx`, importar `Lancamentos` e adicionar dentro de `<Route element={<RotaProtegida />}>`:
```jsx
<Route path="/lancamentos" element={<Lancamentos />} />
```

- [ ] **Step 6: Verificar no navegador**

Run: `cd frontend && npm run build` (sem erros). Com os dois servidores no ar:
1. Crie uma entrada (Salário) e uma saída simples; confira totais e saldo no topo e no Dashboard.
2. Crie um cartão em Fontes/Destinos; em Novo lançamento escolha saída + esse cartão: o campo "Parcelas" aparece. Lance R$ 100,00 em 3x e confira 33,34 / 33,33 / 33,33 com "— 1/3", "— 2/3", "— 3/3".
3. Exclua uma parcela: o modal pergunta "Só esta" ou "Todas as parcelas".
4. Envie valor vazio: erro junto do campo Valor. Altere filtros e confira a paginação (crie >20 lançamentos ou use o seed da Task 10).

- [ ] **Step 7: Checkpoint de commit**

```bash
git add frontend/src
git commit -m "feat: telas de lançamentos e dashboard"
```

---

### Task 8: Relatórios no back-end (categorias, fontes/destinos, faturas)

**Files:**
- Create: `backend/src/models/relatorio.js`, `backend/src/models/fatura.js`, `backend/src/routes/relatorios.routes.js`
- Modify: `backend/src/server.js`
- Test: `backend/test/relatorios.test.js`

**Interfaces:**
- Consumes: `validarPeriodo` (`req.periodo`), `ErroApi`, `inteiroPositivo`, `periodoAnterior`, `hojeISO`, `somarValores`, `percentual`, `arredondar`, `paraCentavos`, `deCentavos`, `calcularFatura`, `listarFaturas`.
- Produces:
  - `Relatorio.categorias(usuarioId, {inicio, fim}) → {periodo, periodoAnterior, totalSaidas, totalEntradas, categorias:[{id,nome,total,percentual,periodoAnterior,variacao}], entradas:[{id,nome,total}]}`.
  - `Relatorio.fontesDestinos(usuarioId, {inicio, fim}) → {periodo, itens:[{id,nome,tipo,entradas,saidas,saldo|null}]}` (`saldo` só para `tipo === 'conta'`).
  - `Fatura.previsao(usuarioId, meses, hoje = hojeISO()) → [{cartaoId, nome, limite, diaFechamento, diaVencimento, limiteUtilizado, limiteDisponivel, faturas:[{referencia, fechamento, vencimento, atual, total, lancamentos:[{id,descricao,valor,data,parcelaAtual,totalParcelas,categoriaNome}]}]}]` (`faturas` = a atual + `meses` seguintes).
  - `Fatura.resumo(usuarioId, hoje = hojeISO()) → {vencido, aVencer:{'AAAA-MM': total}, parcelas:{'AAAA-MM': total}}` (`vencido`: faturas com vencimento anterior a `hoje`; `aVencer`: vencimento a partir de `hoje`; `parcelas`: só compras parceladas a vencer). Usado pela saúde financeira (Task 11).
  - Rotas `GET /api/relatorios/categorias`, `/fontes-destinos`, `/faturas?meses=3`.

- [ ] **Step 1: Testes (falham primeiro)**

`backend/test/relatorios.test.js`:
```js
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar, encerrar, requisitar, criarUsuario } from './helpers.js';

let a;
let b;
let cats;
let conta;
let cartao;
let renda;

const cat = (nome, tipo = 'saida') => cats.find((c) => c.nome === nome && c.tipo === tipo);
const lancar = (corpo, token = a.token) => requisitar('POST', '/lancamentos', { token, corpo });
const saida = (descricao, valor, data, nomeCat, fonte = conta, extra = {}) =>
  lancar({ tipo: 'saida', descricao, valor, data, categoriaId: cat(nomeCat).id, fonteDestinoId: fonte.id, ...extra });

before(async () => {
  await iniciar();
  a = await criarUsuario('A');
  b = await criarUsuario('B');
  cats = (await requisitar('GET', '/categorias', { token: a.token })).corpo;
  conta = (await requisitar('GET', '/fontes-destinos', { token: a.token })).corpo[0];
  cartao = (await requisitar('POST', '/fontes-destinos', {
    token: a.token, corpo: { nome: 'Nubank', tipo: 'cartao_credito', diaFechamento: 3, diaVencimento: 10, limite: 5000 },
  })).corpo;
  renda = (await requisitar('POST', '/fontes-destinos', { token: a.token, corpo: { nome: 'Empresa', tipo: 'renda' } })).corpo;

  await saida('Aluguel', 1500, '2026-10-05', 'Moradia');
  await saida('Mercado', 980.5, '2026-10-10', 'Alimentação');
  await saida('Uber', 769.5, '2026-10-15', 'Mobilidade');
  await saida('Aluguel', 1500, '2026-09-05', 'Moradia');
  await saida('Mercado', 870, '2026-09-10', 'Alimentação');
  await saida('Uber', 812.3, '2026-09-15', 'Mobilidade');
  await saida('Cinema', 40, '2026-08-20', 'Lazer'); // fora dos dois períodos
  await lancar({ tipo: 'entrada', descricao: 'Salário', valor: 5000, data: '2026-10-05', categoriaId: cat('Salário', 'entrada').id, fonteDestinoId: renda.id });
});
after(encerrar);

test('exige token', async () => {
  for (const r of ['/relatorios/categorias', '/relatorios/fontes-destinos', '/relatorios/faturas']) {
    assert.equal((await requisitar('GET', r)).status, 401);
  }
});

test('relatório por categoria bate com o exemplo do PDF', async () => {
  const r = await requisitar('GET', '/relatorios/categorias?inicio=2026-10-01&fim=2026-10-31', { token: a.token });
  assert.equal(r.status, 200);
  assert.deepEqual(r.corpo.periodo, { inicio: '2026-10-01', fim: '2026-10-31' });
  assert.deepEqual(r.corpo.periodoAnterior, { inicio: '2026-09-01', fim: '2026-09-30' });
  assert.equal(r.corpo.totalSaidas, 3250);
  assert.equal(r.corpo.totalEntradas, 5000);
  const [moradia, alimentacao, mobilidade] = r.corpo.categorias;
  assert.deepEqual([moradia.nome, moradia.total, moradia.percentual, moradia.periodoAnterior], ['Moradia', 1500, 46.15, 1500]);
  assert.deepEqual([alimentacao.nome, alimentacao.total, alimentacao.percentual, alimentacao.periodoAnterior], ['Alimentação', 980.5, 30.17, 870]);
  assert.deepEqual([mobilidade.nome, mobilidade.total, mobilidade.percentual, mobilidade.periodoAnterior], ['Mobilidade', 769.5, 23.68, 812.3]);
  assert.equal(alimentacao.variacao, 110.5);
  assert.deepEqual(r.corpo.entradas.map((e) => [e.nome, e.total]), [['Salário', 5000]]);
});

test('categoria que só existia no período anterior aparece com total 0', async () => {
  const r = await requisitar('GET', '/relatorios/categorias?inicio=2026-09-01&fim=2026-09-30', { token: a.token });
  assert.equal(r.corpo.periodoAnterior.inicio, '2026-08-01');
  const lazer = r.corpo.categorias.find((c) => c.nome === 'Lazer');
  assert.deepEqual([lazer.total, lazer.percentual, lazer.periodoAnterior, lazer.variacao], [0, 0, 40, -40]);
});

test('Review Focus 5: período sem dados não gera NaN nem divisão por zero', async () => {
  const r = await requisitar('GET', '/relatorios/categorias?inicio=2020-01-01&fim=2020-01-31', { token: a.token });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.totalSaidas, 0);
  assert.deepEqual(r.corpo.categorias, []);
  assert.equal(JSON.stringify(r.corpo).includes('null'), false);
  const f = await requisitar('GET', '/relatorios/fontes-destinos?inicio=2020-01-01&fim=2020-01-31', { token: a.token });
  assert.equal(f.status, 200);
  assert.ok(f.corpo.itens.every((i) => i.entradas === 0 && i.saidas === 0));
});

test('Review Focus 4: período inválido ou invertido: 400', async () => {
  for (const q of ['inicio=abc&fim=2026-10-31', 'inicio=2026-10-01&fim=2026-02-30', 'inicio=2026-10-31&fim=2026-10-01']) {
    for (const rota of ['categorias', 'fontes-destinos']) {
      const r = await requisitar('GET', `/relatorios/${rota}?${q}`, { token: a.token });
      assert.equal(r.status, 400, `${rota}?${q}`);
      assert.ok(r.corpo.campos);
    }
  }
});

test('relatório por fonte/destino: entradas, saídas e saldo só para conta', async () => {
  await saida('Compra cartão', 100, '2026-10-12', 'Lazer', cartao);
  const r = await requisitar('GET', '/relatorios/fontes-destinos?inicio=2026-10-01&fim=2026-10-31', { token: a.token });
  assert.equal(r.status, 200);
  const por = (nome) => r.corpo.itens.find((i) => i.nome === nome);
  assert.deepEqual([por('Empresa').entradas, por('Empresa').saidas, por('Empresa').saldo], [5000, 0, null]);
  assert.deepEqual([por('Conta corrente').entradas, por('Conta corrente').saidas, por('Conta corrente').saldo], [0, 3250, -3250]);
  assert.deepEqual([por('Nubank').saidas, por('Nubank').saldo], [100, null]);
});

test('relatórios só enxergam dados do próprio usuário', async () => {
  const r = await requisitar('GET', '/relatorios/categorias?inicio=2026-10-01&fim=2026-10-31', { token: b.token });
  assert.equal(r.corpo.totalSaidas, 0);
  assert.deepEqual(r.corpo.categorias, []);
});

test('previsão de faturas: parcelas futuras, fechamento, limite usado e disponível', async () => {
  const Fatura = await import('../src/models/fatura.js');
  const u = await criarUsuario('Faturas');
  const catsU = (await requisitar('GET', '/categorias', { token: u.token })).corpo;
  const cartaoU = (await requisitar('POST', '/fontes-destinos', {
    token: u.token, corpo: { nome: 'Nubank', tipo: 'cartao_credito', diaFechamento: 3, diaVencimento: 10, limite: 5000 },
  })).corpo;
  const catU = (n) => catsU.find((c) => c.nome === n && c.tipo === 'saida').id;
  const l = (descricao, valor, data, nome, extra = {}) => lancar(
    { tipo: 'saida', descricao, valor, data, categoriaId: catU(nome), fonteDestinoId: cartaoU.id, ...extra }, u.token);

  await l('Notebook', 1000, '2026-10-20', 'Educação', { totalParcelas: 10 });
  await l('Mercado', 200, '2026-11-03', 'Alimentação'); // no dia do fechamento -> fatura seguinte
  await l('Lanche', 50, '2026-11-02', 'Alimentação');   // fatura de nov (já fechada e vencida em 20/11)

  const [prev] = await Fatura.previsao(u.id, 3, '2026-11-20');
  assert.equal(prev.nome, 'Nubank');
  assert.deepEqual(prev.faturas.map((f) => f.referencia), ['2026-12', '2027-01', '2027-02', '2027-03']);
  assert.equal(prev.faturas[0].atual, true);
  assert.deepEqual([prev.faturas[0].fechamento, prev.faturas[0].vencimento], ['2026-12-03', '2026-12-10']);
  assert.deepEqual(prev.faturas.map((f) => f.total), [300, 100, 100, 100]);
  const dez = prev.faturas[0].lancamentos.map((x) => `${x.descricao} ${x.parcelaAtual}/${x.totalParcelas}`);
  assert.deepEqual(dez, ['Notebook 2/10', 'Mercado 1/1']);
  assert.equal(prev.limiteUtilizado, 1100);
  assert.equal(prev.limiteDisponivel, 3900);

  const resumo = await Fatura.resumo(u.id, '2026-11-20');
  assert.equal(resumo.vencido, 150); // parcela 1 do notebook (100) + lanche (50)
  assert.equal(resumo.aVencer['2026-12'], 300);
  assert.equal(resumo.parcelas['2026-12'], 100);
});

test('GET /relatorios/faturas: formato, validação de meses e isolamento', async () => {
  const ok = await requisitar('GET', '/relatorios/faturas?meses=3', { token: a.token });
  assert.equal(ok.status, 200);
  assert.equal(ok.corpo.length, 1);
  assert.equal(ok.corpo[0].faturas.length, 4);
  assert.equal((await requisitar('GET', '/relatorios/faturas', { token: a.token })).status, 200);
  for (const m of ['0', '13', 'abc', '-1']) {
    assert.equal((await requisitar('GET', `/relatorios/faturas?meses=${m}`, { token: a.token })).status, 400, m);
  }
  const doB = await requisitar('GET', '/relatorios/faturas', { token: b.token });
  assert.deepEqual(doB.corpo, []);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && node --test test/relatorios.test.js`
Expected: FAIL (rotas `/api/relatorios/*` inexistentes).

- [ ] **Step 3: Model de relatórios**

`backend/src/models/relatorio.js`:
```js
import { pool } from '../config/db.js';
import { periodoAnterior } from './datas.js';
import { arredondar, percentual, somarValores } from './dinheiro.js';

async function totaisPorCategoria(usuarioId, tipo, inicio, fim) {
  const { rows } = await pool.query(
    `SELECT c.id, c.nome, SUM(l.valor) AS total
       FROM lancamentos l
       JOIN categorias c ON c.id = l.categoria_id
      WHERE l.usuario_id = $1 AND l.tipo = $2 AND l.data BETWEEN $3 AND $4
      GROUP BY c.id, c.nome
      ORDER BY total DESC, c.nome`,
    [usuarioId, tipo, inicio, fim]);
  return rows.map((r) => ({ id: r.id, nome: r.nome, total: r.total }));
}

export async function categorias(usuarioId, { inicio, fim }) {
  const anterior = periodoAnterior(inicio, fim);
  const [saidas, entradas, saidasAnteriores] = await Promise.all([
    totaisPorCategoria(usuarioId, 'saida', inicio, fim),
    totaisPorCategoria(usuarioId, 'entrada', inicio, fim),
    totaisPorCategoria(usuarioId, 'saida', anterior.inicio, anterior.fim),
  ]);

  const totalSaidas = somarValores(saidas.map((s) => s.total));
  const totalEntradas = somarValores(entradas.map((e) => e.total));
  const anteriorPorId = new Map(saidasAnteriores.map((s) => [s.id, s.total]));

  const lista = saidas.map((s) => {
    const ant = anteriorPorId.get(s.id) ?? 0;
    return { ...s, percentual: percentual(s.total, totalSaidas), periodoAnterior: ant, variacao: arredondar(s.total - ant) };
  });
  for (const ant of saidasAnteriores) { // existia antes e sumiu: mostra a redução
    if (!saidas.some((s) => s.id === ant.id)) {
      lista.push({ id: ant.id, nome: ant.nome, total: 0, percentual: 0, periodoAnterior: ant.total, variacao: -ant.total });
    }
  }
  lista.sort((x, y) => y.total - x.total || x.nome.localeCompare(y.nome));

  return {
    periodo: { inicio, fim },
    periodoAnterior: anterior,
    totalSaidas,
    totalEntradas,
    categorias: lista,
    entradas,
  };
}

export async function fontesDestinos(usuarioId, { inicio, fim }) {
  const { rows } = await pool.query(
    `SELECT f.id, f.nome, f.tipo,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'entrada'), 0) AS entradas,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'saida'), 0) AS saidas
       FROM fontes_destinos f
       LEFT JOIN lancamentos l
              ON l.fonte_destino_id = f.id AND l.usuario_id = $1 AND l.data BETWEEN $2 AND $3
      WHERE f.usuario_id = $1
      GROUP BY f.id, f.nome, f.tipo
      ORDER BY f.tipo, f.nome`,
    [usuarioId, inicio, fim]);
  return {
    periodo: { inicio, fim },
    itens: rows.map((r) => ({
      id: r.id, nome: r.nome, tipo: r.tipo, entradas: r.entradas, saidas: r.saidas,
      saldo: r.tipo === 'conta' ? arredondar(r.entradas - r.saidas) : null,
    })),
  };
}
```

- [ ] **Step 4: Model de faturas**

`backend/src/models/fatura.js`:
```js
import { pool } from '../config/db.js';
import { calcularFatura, listarFaturas } from './calculoFatura.js';
import { hojeISO } from './datas.js';
import { arredondar, deCentavos, paraCentavos, somarValores } from './dinheiro.js';

// Para cada cartão do usuário, as compras (saídas) já com a fatura em que cada parcela cai.
async function carregar(usuarioId) {
  const { rows: cartoes } = await pool.query(
    `SELECT id, nome, dia_fechamento, dia_vencimento, limite
       FROM fontes_destinos WHERE usuario_id = $1 AND tipo = 'cartao_credito' ORDER BY nome`, [usuarioId]);
  const resultado = [];
  for (const cartao of cartoes) {
    const regra = { diaFechamento: cartao.dia_fechamento, diaVencimento: cartao.dia_vencimento };
    const { rows } = await pool.query(
      `SELECT l.id, l.descricao, l.valor, l.data, l.parcela_atual, l.total_parcelas, c.nome AS categoria_nome
         FROM lancamentos l JOIN categorias c ON c.id = l.categoria_id
        WHERE l.usuario_id = $1 AND l.fonte_destino_id = $2 AND l.tipo = 'saida'
        ORDER BY l.data, l.id`, [usuarioId, cartao.id]);
    const itens = rows.map((r) => ({ ...r, fatura: calcularFatura(r.data, regra, r.parcela_atual) }));
    resultado.push({ cartao, regra, itens });
  }
  return resultado;
}

export async function previsao(usuarioId, meses, hoje = hojeISO()) {
  const cartoes = await carregar(usuarioId);
  return cartoes.map(({ cartao, regra, itens }) => {
    const faturas = listarFaturas(hoje, regra, meses + 1).map((f, i) => {
      const lancamentos = itens
        .filter((x) => x.fatura.referencia === f.referencia)
        .map((x) => ({
          id: x.id, descricao: x.descricao, valor: x.valor, data: x.data,
          parcelaAtual: x.parcela_atual, totalParcelas: x.total_parcelas, categoriaNome: x.categoria_nome,
        }));
      return { ...f, atual: i === 0, total: somarValores(lancamentos.map((l) => l.valor)), lancamentos };
    });
    // O limite fica comprometido pelo total das parcelas ainda não vencidas.
    const utilizado = somarValores(itens.filter((x) => x.fatura.vencimento >= hoje).map((x) => x.valor));
    return {
      cartaoId: cartao.id,
      nome: cartao.nome,
      limite: cartao.limite,
      diaFechamento: cartao.dia_fechamento,
      diaVencimento: cartao.dia_vencimento,
      limiteUtilizado: utilizado,
      limiteDisponivel: arredondar(cartao.limite - utilizado),
      faturas,
    };
  });
}

// Totais de todos os cartões: o que já venceu e o que vence por mês (para a saúde financeira).
export async function resumo(usuarioId, hoje = hojeISO()) {
  let vencido = 0;
  const aVencer = {};
  const parcelas = {};
  for (const { itens } of await carregar(usuarioId)) {
    for (const x of itens) {
      const centavos = paraCentavos(x.valor);
      if (x.fatura.vencimento < hoje) {
        vencido += centavos;
      } else {
        aVencer[x.fatura.referencia] = (aVencer[x.fatura.referencia] ?? 0) + centavos;
        if (x.total_parcelas > 1) parcelas[x.fatura.referencia] = (parcelas[x.fatura.referencia] ?? 0) + centavos;
      }
    }
  }
  const emReais = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, deCentavos(v)]));
  return { vencido: deCentavos(vencido), aVencer: emReais(aVencer), parcelas: emReais(parcelas) };
}
```

- [ ] **Step 5: Rotas**

`backend/src/routes/relatorios.routes.js`:
```js
import { Router } from 'express';
import { ErroApi } from '../middlewares/erros.js';
import { inteiroPositivo, validarPeriodo } from '../middlewares/validar.js';
import * as Relatorio from '../models/relatorio.js';
import * as Fatura from '../models/fatura.js';

const router = Router();

router.get('/categorias', validarPeriodo, async (req, res) => {
  res.json(await Relatorio.categorias(req.usuarioId, req.periodo));
});

router.get('/fontes-destinos', validarPeriodo, async (req, res) => {
  res.json(await Relatorio.fontesDestinos(req.usuarioId, req.periodo));
});

router.get('/faturas', async (req, res) => {
  let meses = 3;
  if (req.query.meses !== undefined) {
    meses = typeof req.query.meses === 'string' ? inteiroPositivo(req.query.meses) : null;
    if (meses === null || meses > 12) {
      throw new ErroApi(400, 'Parâmetro inválido.', { meses: 'Informe um número de meses de 1 a 12.' });
    }
  }
  res.json(await Fatura.previsao(req.usuarioId, meses));
});

export default router;
```

Em `backend/src/server.js`, adicionar:
```js
import relatoriosRoutes from './routes/relatorios.routes.js';
```
```js
app.use('/api/relatorios', autenticar, relatoriosRoutes);
```

- [ ] **Step 6: Rodar os testes**

Run: `cd backend && node --test test/relatorios.test.js`
Expected: PASS em todos. Depois `npm test` completo: PASS.

- [ ] **Step 7: Checkpoint de commit**

```bash
git add backend/src backend/test
git commit -m "feat: relatórios por categoria, por fonte/destino e previsão de faturas"
```

---

### Task 9: Relatórios e faturas no front-end

**Files:**
- Create: `frontend/src/components/paginas/Relatorios.jsx`, `frontend/src/components/paginas/Faturas.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `GET /api/relatorios/categorias|fontes-destinos|faturas` (Task 8); `useCarregar`, `Estado`, `CampoForm`, `moeda`, `dataBR`, `percentual`, `mesAtual`; `recharts` (`PieChart`, `BarChart`).
- Produces: páginas `Relatorios` (abas "Por categoria" e "Por fonte/destino") e `Faturas`.

- [ ] **Step 1: Página de relatórios**

`frontend/src/components/paginas/Relatorios.jsx`:
```jsx
import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../../services/api.js';
import { useCarregar } from '../../utils/useCarregar.js';
import { dataBR, mesAtual, moeda, percentual } from '../../utils/formatar.js';
import { Estado } from '../comuns/Estados.jsx';
import CampoForm from '../comuns/CampoForm.jsx';

const CORES = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c'];

function PorCategoria({ inicio, fim }) {
  const { dados, carregando, erro, recarregar } = useCarregar(
    () => api.get(`/relatorios/categorias?inicio=${inicio}&fim=${fim}`), [inicio, fim]);
  const vazio = dados && dados.categorias.length === 0 && dados.entradas.length === 0;

  return (
    <Estado carregando={carregando} erro={erro} recarregar={recarregar} vazio={vazio} textoVazio="Sem movimentações no período.">
      {dados && (
        <>
          <p>
            Comparando com {dataBR(dados.periodoAnterior.inicio)} a {dataBR(dados.periodoAnterior.fim)}.
            Total de saídas: <strong className="saida">{moeda(dados.totalSaidas)}</strong> · Total de entradas:{' '}
            <strong className="entrada">{moeda(dados.totalEntradas)}</strong>
          </p>
          {dados.categorias.some((c) => c.total > 0) && (
            <div className="grafico">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dados.categorias.filter((c) => c.total > 0)} dataKey="total" nameKey="nome"
                    innerRadius={60} outerRadius={110} label={(e) => e.nome}>
                    {dados.categorias.filter((c) => c.total > 0).map((c, i) => <Cell key={c.id} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => moeda(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <h3>Saídas por categoria</h3>
          <table>
            <thead>
              <tr><th>Categoria</th><th className="num">Total</th><th className="num">%</th>
                <th className="num">Período anterior</th><th className="num">Variação</th></tr>
            </thead>
            <tbody>
              {dados.categorias.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td className="num">{moeda(c.total)}</td>
                  <td className="num">{percentual(c.percentual)}</td>
                  <td className="num">{moeda(c.periodoAnterior)}</td>
                  <td className={`num ${c.variacao > 0 ? 'saida' : c.variacao < 0 ? 'entrada' : ''}`}>
                    {c.variacao > 0 ? '▲ aumento ' : c.variacao < 0 ? '▼ redução ' : '= '}{moeda(Math.abs(c.variacao))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 style={{ marginTop: '1.5rem' }}>Entradas por categoria</h3>
          {dados.entradas.length === 0 ? <p className="estado">Sem entradas no período.</p> : (
            <table>
              <thead><tr><th>Categoria</th><th className="num">Total</th></tr></thead>
              <tbody>
                {dados.entradas.map((c) => (
                  <tr key={c.id}><td>{c.nome}</td><td className="num entrada">{moeda(c.total)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </Estado>
  );
}

function PorFonteDestino({ inicio, fim }) {
  const { dados, carregando, erro, recarregar } = useCarregar(
    () => api.get(`/relatorios/fontes-destinos?inicio=${inicio}&fim=${fim}`), [inicio, fim]);
  const vazio = dados && dados.itens.every((i) => i.entradas === 0 && i.saidas === 0);

  return (
    <Estado carregando={carregando} erro={erro} recarregar={recarregar} vazio={vazio} textoVazio="Sem movimentações no período.">
      {dados && (
        <>
          <div className="grafico">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados.itens}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" />
                <YAxis tickFormatter={(v) => moeda(v)} width={90} />
                <Tooltip formatter={(v) => moeda(v)} />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="#16a34a" />
                <Bar dataKey="saidas" name="Saídas" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table>
            <thead>
              <tr><th>Fonte/destino</th><th>Tipo</th><th className="num">Entradas</th><th className="num">Saídas</th><th className="num">Saldo</th></tr>
            </thead>
            <tbody>
              {dados.itens.map((i) => (
                <tr key={i.id}>
                  <td>{i.nome}</td>
                  <td>{{ renda: 'Renda', conta: 'Conta', cartao_credito: 'Cartão' }[i.tipo]}</td>
                  <td className="num entrada">{moeda(i.entradas)}</td>
                  <td className="num saida">{moeda(i.saidas)}</td>
                  <td className={`num ${i.saldo != null && i.saldo < 0 ? 'saida' : ''}`}>{i.saldo != null ? moeda(i.saldo) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Estado>
  );
}

export default function Relatorios() {
  const [aba, setAba] = useState('categorias');
  const [periodo, setPeriodo] = useState(mesAtual());
  const periodoOk = periodo.inicio && periodo.fim && periodo.inicio <= periodo.fim;

  return (
    <section>
      <h2>Relatórios</h2>
      <div className="abas">
        <button type="button" className={aba === 'categorias' ? 'ativa' : ''} onClick={() => setAba('categorias')}>Por categoria</button>
        <button type="button" className={aba === 'fontes' ? 'ativa' : ''} onClick={() => setAba('fontes')}>Por fonte/destino</button>
      </div>
      <div className="barra">
        <CampoForm id="r-inicio" rotulo="De">
          <input id="r-inicio" type="date" value={periodo.inicio} onChange={(e) => setPeriodo({ ...periodo, inicio: e.target.value })} />
        </CampoForm>
        <CampoForm id="r-fim" rotulo="Até">
          <input id="r-fim" type="date" value={periodo.fim} onChange={(e) => setPeriodo({ ...periodo, fim: e.target.value })} />
        </CampoForm>
      </div>
      {!periodoOk ? <p className="erro-bloco" role="alert">Informe um período válido (a data inicial não pode ser maior que a final).</p>
        : aba === 'categorias' ? <PorCategoria inicio={periodo.inicio} fim={periodo.fim} />
        : <PorFonteDestino inicio={periodo.inicio} fim={periodo.fim} />}
    </section>
  );
}
```

- [ ] **Step 2: Página de faturas**

`frontend/src/components/paginas/Faturas.jsx`:
```jsx
import { api } from '../../services/api.js';
import { useCarregar } from '../../utils/useCarregar.js';
import { dataBR, moeda } from '../../utils/formatar.js';
import { Estado } from '../comuns/Estados.jsx';

function Fatura({ fatura }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <h4 style={{ margin: '0 0 .4rem' }}>
        {fatura.atual ? 'Fatura atual (aberta)' : 'Previsão'} — vence em {dataBR(fatura.vencimento)}
        <small> (fecha em {dataBR(fatura.fechamento)})</small>
      </h4>
      {fatura.lancamentos.length === 0 ? <p className="estado">Sem lançamentos nesta fatura.</p> : (
        <table>
          <thead><tr><th>Data da compra</th><th>Descrição</th><th>Categoria</th><th className="num">Valor</th></tr></thead>
          <tbody>
            {fatura.lancamentos.map((l) => (
              <tr key={l.id}>
                <td>{dataBR(l.data)}</td>
                <td>{l.descricao}{l.totalParcelas > 1 ? ` — ${l.parcelaAtual}/${l.totalParcelas}` : ''}</td>
                <td>{l.categoriaNome}</td>
                <td className="num">{moeda(l.valor)}</td>
              </tr>
            ))}
            <tr><th colSpan={3}>Total da fatura</th><th className="num">{moeda(fatura.total)}</th></tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Faturas() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/relatorios/faturas?meses=3'), []);
  return (
    <section>
      <h2>Faturas dos cartões</h2>
      <Estado carregando={carregando} erro={erro} recarregar={recarregar} vazio={dados?.length === 0}
        textoVazio="Você ainda não tem cartão de crédito. Cadastre um em Fontes/Destinos.">
        {dados?.map((c) => (
          <article key={c.cartaoId} className="card" style={{ marginBottom: '1.5rem' }}>
            <h3>{c.nome}</h3>
            <div className="cards">
              <div className="card"><small>Limite</small><strong>{moeda(c.limite)}</strong></div>
              <div className="card"><small>Utilizado</small><strong className="saida">{moeda(c.limiteUtilizado)}</strong></div>
              <div className="card"><small>Disponível</small>
                <strong className={c.limiteDisponivel >= 0 ? 'entrada' : 'saida'}>{moeda(c.limiteDisponivel)}</strong></div>
            </div>
            {c.faturas.map((f) => <Fatura key={f.referencia} fatura={f} />)}
          </article>
        ))}
      </Estado>
    </section>
  );
}
```

- [ ] **Step 3: Rotas**

Em `frontend/src/App.jsx`, importar `Relatorios` e `Faturas` e adicionar dentro de `<Route element={<RotaProtegida />}>`:
```jsx
<Route path="/relatorios" element={<Relatorios />} />
<Route path="/faturas" element={<Faturas />} />
```

- [ ] **Step 4: Verificar no navegador**

Run: `cd frontend && npm run build` (sem erros). Com dados de teste (ou o seed da Task 10):
1. Relatórios → "Por categoria": rosca, tabela com % e variação (▲/▼) e entradas por categoria. Troque para um período sem dados: aparece "Sem movimentações no período." sem erro.
2. "Por fonte/destino": barras e tabela; saldo só nas contas.
3. Faturas: cada cartão mostra limite, utilizado e disponível, a fatura aberta e as 3 seguintes, com parcelas "— k/N". Confirme que a compra parcelada da Task 7 aparece uma parcela por fatura.

- [ ] **Step 5: Checkpoint de commit**

```bash
git add frontend/src
git commit -m "feat: telas de relatórios com gráficos e previsão de faturas"
```

---

### Task 10: Seed de demonstração (2 usuários, 3+ meses de lançamentos)

**Files:**
- Create: `backend/database/seed.js`

**Interfaces:**
- Consumes: `pool`, `transacao`, `Usuario.criar`, `Categoria.criarPadrao`, `FonteDestino.criarPadrao`, `dividirParcelas`, `arredondar`, `bcrypt`.
- Produces: `npm run db:seed` (idempotente: recria os dois usuários de demonstração). Credenciais: `ana@exemplo.com` e `bruno@exemplo.com`, senha `Senha1234`.

- [ ] **Step 1: Escrever o seed**

`backend/database/seed.js`:
```js
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { pool, transacao } from '../src/config/db.js';
import * as Usuario from '../src/models/usuario.js';
import * as Categoria from '../src/models/categoria.js';
import * as FonteDestino from '../src/models/fonteDestino.js';
import { arredondar, dividirParcelas } from '../src/models/dinheiro.js';

const SENHA = 'Senha1234';
const USUARIOS = [
  { nome: 'Ana Souza', email: 'ana@exemplo.com', cpf: '12345678909', fator: 1 },
  { nome: 'Bruno Lima', email: 'bruno@exemplo.com', cpf: '98765432100', fator: 0.7 },
];
const MESES_ATRAS = [3, 2, 1, 0];

const hoje = new Date();
const pad = (n) => String(n).padStart(2, '0');

// Data `meses` meses atrás; no mês corrente nunca passa de hoje.
function data(meses, dia) {
  const ref = new Date(hoje.getFullYear(), hoje.getMonth() - meses, 1);
  const ultimo = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const limite = meses === 0 ? Math.min(ultimo, hoje.getDate()) : ultimo;
  return `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}-${pad(Math.min(dia, limite))}`;
}

// [diaDoMes, tipo, descrição, valor, categoria, fonte]
const MENSAIS = [
  [5, 'entrada', 'Salário', 5000, 'Salário', 'Salário'],
  [10, 'saida', 'Aluguel', 1500, 'Moradia', 'Conta corrente'],
  [8, 'saida', 'Mercado', 420.75, 'Alimentação', 'Nubank'],
  [22, 'saida', 'Mercado', 380.1, 'Alimentação', 'Nubank'],
  [12, 'saida', 'Uber', 85.9, 'Mobilidade', 'Nubank'],
  [18, 'saida', 'Cinema', 64, 'Lazer', 'Visa'],
  [25, 'saida', 'Farmácia', 129.9, 'Saúde', 'Conta corrente'],
  [3, 'saida', 'Streaming (dia do fechamento)', 39.9, 'Lazer', 'Nubank'],
  [25, 'saida', 'Combustível (dia do fechamento)', 200, 'Mobilidade', 'Visa'],
];

async function semear(client, u) {
  await client.query('DELETE FROM usuarios WHERE email = $1', [u.email]);
  const senhaHash = await bcrypt.hash(SENHA, 10);
  const usuario = await Usuario.criar({ nome: u.nome, email: u.email, cpf: u.cpf, senhaHash }, client);
  await Categoria.criarPadrao(usuario.id, client);
  await FonteDestino.criarPadrao(usuario.id, client);

  const novaFonte = (nome, tipo, extra = {}) => client.query(
    `INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [usuario.id, nome, tipo, extra.fecha ?? null, extra.vence ?? null, extra.limite ?? null, extra.reserva ?? false]);
  await novaFonte('Salário', 'renda');
  await novaFonte('Poupança', 'conta', { reserva: true });
  await novaFonte('Nubank', 'cartao_credito', { fecha: 3, vence: 10, limite: 5000 });
  await novaFonte('Visa', 'cartao_credito', { fecha: 25, vence: 5, limite: 3000 });

  const { rows: cats } = await client.query('SELECT id, nome, tipo FROM categorias WHERE usuario_id = $1', [usuario.id]);
  const { rows: fontes } = await client.query('SELECT id, nome FROM fontes_destinos WHERE usuario_id = $1', [usuario.id]);
  const cat = (nome, tipo) => cats.find((c) => c.nome === nome && c.tipo === tipo).id;
  const fonte = (nome) => fontes.find((f) => f.nome === nome).id;

  const inserir = (tipo, descricao, valor, dataLanc, categoria, nomeFonte, parcela = 1, total = 1, grupo = null) =>
    client.query(
      `INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id,
                                parcela_atual, total_parcelas, grupo_parcelamento)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [usuario.id, tipo, descricao, valor, dataLanc, cat(categoria, tipo), fonte(nomeFonte), parcela, total, grupo]);

  for (const meses of MESES_ATRAS) {
    for (const [dia, tipo, descricao, valor, categoria, nomeFonte] of MENSAIS) {
      await inserir(tipo, descricao, arredondar(valor * u.fator), data(meses, dia), categoria, nomeFonte);
    }
  }
  await inserir('entrada', 'Freelance', arredondar(800 * u.fator), data(1, 15), 'Outros', 'Salário');

  // Compras parceladas no cartão (data da compra repetida em todas as parcelas)
  const parcelado = async (descricao, valor, meses, dia, categoria, nomeFonte, n) => {
    const grupo = randomUUID();
    const valores = dividirParcelas(arredondar(valor * u.fator), n);
    for (let i = 0; i < n; i += 1) {
      await inserir('saida', descricao, valores[i], data(meses, dia), categoria, nomeFonte, i + 1, n, grupo);
    }
  };
  await parcelado('Notebook', 3600, 2, 12, 'Educação', 'Nubank', 10);
  await parcelado('Geladeira', 2400, 1, 20, 'Moradia', 'Visa', 6);
}

try {
  await transacao(async (client) => {
    for (const u of USUARIOS) await semear(client, u);
  });
  console.log('Seed concluído. Usuários de demonstração:');
  for (const u of USUARIOS) console.log(`  ${u.email} / ${SENHA}`);
} finally {
  await pool.end();
}
```

- [ ] **Step 2: Rodar o seed duas vezes (idempotência)**

Run: `cd backend && npm run db:seed && npm run db:seed`
Expected: nas duas execuções, "Seed concluído..." e as duas credenciais, sem erro de duplicidade.

- [ ] **Step 3: Conferir os dados**

Run:
```bash
docker exec financas-db psql -U financas -d financas -c "SELECT u.email, COUNT(l.id) AS lancamentos, MIN(l.data), MAX(l.data) FROM usuarios u JOIN lancamentos l ON l.usuario_id = u.id GROUP BY u.email"
```
Expected: duas linhas (`ana@exemplo.com` e `bruno@exemplo.com`), cada uma com dezenas de lançamentos cobrindo pelo menos 3 meses.

- [ ] **Step 4: Conferir pela API e pela interface**

Com o back-end no ar, faça login como Ana pelo front (`ana@exemplo.com` / `Senha1234`) e confira: Dashboard com totais, Faturas com Notebook (parcelas k/10) e Geladeira (k/6), e que as compras "(dia do fechamento)" caem na fatura do mês seguinte. Entre como Bruno e confirme que os valores são outros (isolamento).

- [ ] **Step 5: Checkpoint de commit**

```bash
git add backend/database/seed.js
git commit -m "feat: seed com 2 usuários e 3 meses de lançamentos"
```

---

### Task 11: Desafio — saúde financeira (back-end e front-end)

**Files:**
- Create: `backend/src/models/saudeFinanceira.js`, `backend/src/routes/saude-financeira.routes.js`, `frontend/src/components/paginas/SaudeFinanceira.jsx`
- Modify: `backend/src/server.js`, `frontend/src/App.jsx`
- Test: `backend/test/saude.test.js`

**Interfaces:**
- Consumes: `Fatura.resumo(usuarioId, hoje)` (Task 8), `pool`, `hojeISO`, `somarMeses`, `arredondar`, `somarValores`.
- Produces: `SaudeFinanceira.calcular(usuarioId, hoje = hojeISO()) → { referencia, aviso, saldoAtual, limites, indicadores:{taxaPoupanca, comprometimentoCartoes, parcelasFuturas, reservaEmergencia, categoriasForaDaCurva}, projecao:[{mes, entradas, saidas, saldo}], dicas:[{tipo:'ok'|'info'|'alerta', texto}] }`; `GET /api/saude-financeira`; `LIMITES` exportado (documentado no README).

- [ ] **Step 1: Testes (falham primeiro)**

`backend/test/saude.test.js`:
```js
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar, encerrar, requisitar, criarUsuario } from './helpers.js';
import { hojeISO, somarMeses } from '../src/models/datas.js';

let a;
let vazio;
let cats;
let conta;
const hoje = hojeISO();
const mes = (n) => somarMeses(hoje.slice(0, 7), n);

before(async () => {
  await iniciar();
  a = await criarUsuario('A');
  vazio = await criarUsuario('Sem dados');
  cats = (await requisitar('GET', '/categorias', { token: a.token })).corpo;
  conta = (await requisitar('GET', '/fontes-destinos', { token: a.token })).corpo[0];
  const lancar = (tipo, nome, valor, data) => requisitar('POST', '/lancamentos', {
    token: a.token,
    corpo: { tipo, descricao: nome, valor, data, categoriaId: cats.find((c) => c.tipo === tipo && c.nome === (tipo === 'entrada' ? 'Salário' : 'Alimentação')).id, fonteDestinoId: conta.id },
  });
  for (const n of [-3, -2, -1]) {
    await lancar('entrada', 'Salário', 5000, `${mes(n)}-05`);
    await lancar('saida', 'Mercado', 4500, `${mes(n)}-10`);
  }
});
after(encerrar);

test('exige token', async () => {
  assert.equal((await requisitar('GET', '/saude-financeira')).status, 401);
});

test('calcula indicadores, projeção e dicas, com aviso educativo', async () => {
  const r = await requisitar('GET', '/saude-financeira', { token: a.token });
  assert.equal(r.status, 200);
  assert.match(r.corpo.aviso, /educativ/i);
  assert.equal(r.corpo.indicadores.taxaPoupanca.mesAnterior, 10);
  assert.equal(r.corpo.indicadores.taxaPoupanca.historico.length, 4);
  assert.equal(r.corpo.projecao.length, 6);
  assert.deepEqual(r.corpo.projecao.map((p) => p.mes), [1, 2, 3, 4, 5, 6].map(mes));
  assert.equal(r.corpo.projecao[0].entradas, 5000);
  assert.equal(r.corpo.projecao[0].saidas, 4500);
  assert.equal(Math.round((r.corpo.projecao[1].saldo - r.corpo.projecao[0].saldo) * 100) / 100, 500);
  assert.ok(Array.isArray(r.corpo.dicas) && r.corpo.dicas.length > 0);
  for (const chave of ['taxaPoupanca', 'comprometimentoCartoes', 'parcelasFuturas', 'reservaEmergencia', 'categoriasForaDaCurva']) {
    assert.ok(chave in r.corpo.indicadores, chave);
  }
});

test('Review Focus 5: usuário sem lançamentos recebe 200, sem NaN, com dica de início', async () => {
  const r = await requisitar('GET', '/saude-financeira', { token: vazio.token });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.indicadores.taxaPoupanca.mesAnterior, null);
  assert.equal(r.corpo.indicadores.comprometimentoCartoes.percentual, null);
  assert.equal(r.corpo.indicadores.reservaEmergencia.temReserva, false);
  assert.equal(r.corpo.projecao.length, 6);
  assert.equal(JSON.stringify(r.corpo).includes('NaN'), false);
  assert.ok(r.corpo.dicas.length >= 1);
});

test('categoria fora da curva é detectada', async () => {
  const cat = cats.find((c) => c.nome === 'Lazer' && c.tipo === 'saida');
  const post = (valor, data) => requisitar('POST', '/lancamentos', {
    token: a.token, corpo: { tipo: 'saida', descricao: 'Lazer', valor, data, categoriaId: cat.id, fonteDestinoId: conta.id },
  });
  for (const n of [-3, -2, -1]) await post(100, `${mes(n)}-15`);
  await post(300, `${hoje.slice(0, 7)}-01`);
  const r = await requisitar('GET', '/saude-financeira', { token: a.token });
  const lazer = r.corpo.indicadores.categoriasForaDaCurva.find((c) => c.categoria === 'Lazer');
  assert.ok(lazer);
  assert.equal(lazer.media, 100);
  assert.equal(lazer.atual, 300);
  assert.equal(lazer.percentualAcima, 200);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && node --test test/saude.test.js`
Expected: FAIL (rota inexistente).

- [ ] **Step 3: Model**

`backend/src/models/saudeFinanceira.js`:
```js
import { pool } from '../config/db.js';
import * as Fatura from './fatura.js';
import { hojeISO, somarMeses } from './datas.js';
import { arredondar, somarValores } from './dinheiro.js';

// Limites usados pelas dicas (documentados no README).
export const LIMITES = {
  poupancaMinima: 10,        // % da renda que vale guardar por mês
  comprometimentoMaximo: 50, // % da renda média comprometida com faturas
  foraDaCurva: 30,           // % acima da média dos 3 meses anteriores
  reservaMinimaMeses: 3,     // meses de despesas cobertos pela reserva
};

const AVISO = 'As informações desta página são educativas e não constituem recomendação financeira profissional.';
const reais = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const extenso = (anoMes) => {
  const [a, m] = anoMes.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const media = (valores) => (valores.length === 0 ? 0 : arredondar(somarValores(valores) / valores.length));

// Totais por mês: entradas, saídas e saídas fora de cartão (de mesInicial até o fim do mês corrente)
async function serieMensal(usuarioId, mesInicial, mesFinal) {
  const { rows } = await pool.query(
    `SELECT to_char(l.data, 'YYYY-MM') AS mes, l.tipo,
            (f.tipo = 'cartao_credito') AS cartao, SUM(l.valor) AS total
       FROM lancamentos l JOIN fontes_destinos f ON f.id = l.fonte_destino_id
      WHERE l.usuario_id = $1 AND to_char(l.data, 'YYYY-MM') BETWEEN $2 AND $3
      GROUP BY 1, 2, 3`, [usuarioId, mesInicial, mesFinal]);
  const mapa = {};
  for (const r of rows) {
    const m = (mapa[r.mes] ??= { entradas: 0, saidas: 0, saidasSemCartao: 0 });
    if (r.tipo === 'entrada') m.entradas = arredondar(m.entradas + r.total);
    else {
      m.saidas = arredondar(m.saidas + r.total);
      if (!r.cartao) m.saidasSemCartao = arredondar(m.saidasSemCartao + r.total);
    }
  }
  return mapa;
}

async function totalPorCategoriaEMes(usuarioId, mesInicial, mesFinal) {
  const { rows } = await pool.query(
    `SELECT c.nome, to_char(l.data, 'YYYY-MM') AS mes, SUM(l.valor) AS total
       FROM lancamentos l JOIN categorias c ON c.id = l.categoria_id
      WHERE l.usuario_id = $1 AND l.tipo = 'saida' AND to_char(l.data, 'YYYY-MM') BETWEEN $2 AND $3
      GROUP BY 1, 2`, [usuarioId, mesInicial, mesFinal]);
  return rows;
}

async function saldoAcumulado(usuarioId, ate, soReserva = false) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor ELSE -l.valor END)
                     FILTER (WHERE NOT (l.tipo = 'saida' AND f.tipo = 'cartao_credito')), 0) AS saldo
       FROM lancamentos l JOIN fontes_destinos f ON f.id = l.fonte_destino_id
      WHERE l.usuario_id = $1 AND l.data <= $2 AND ($3::boolean IS FALSE OR f.reserva = true)`,
    [usuarioId, ate, soReserva]);
  return rows[0].saldo;
}

export async function calcular(usuarioId, hoje = hojeISO()) {
  const atual = hoje.slice(0, 7);
  const anteriores = [-3, -2, -1].map((n) => somarMeses(atual, n));
  const serie = await serieMensal(usuarioId, anteriores[0], atual);
  const get = (m) => serie[m] ?? { entradas: 0, saidas: 0, saidasSemCartao: 0 };
  const cartoes = await Fatura.resumo(usuarioId, hoje);

  // Taxa de poupança por mês
  const historico = [...anteriores, atual].map((mes) => {
    const { entradas, saidas } = get(mes);
    return { mes, entradas, saidas, taxa: entradas > 0 ? arredondar(((entradas - saidas) / entradas) * 100) : null };
  });
  const taxaPoupanca = { atual: historico[3].taxa, mesAnterior: historico[2].taxa, historico };

  const rendaMedia = media(anteriores.map((m) => get(m).entradas));
  const saidasMedia = media(anteriores.map((m) => get(m).saidas));
  const saidasSemCartaoMedia = media(anteriores.map((m) => get(m).saidasSemCartao));

  // Comprometimento: faturas que vencem no mês corrente e nos 2 seguintes ÷ renda dos 3 meses
  const proximos3 = [0, 1, 2].map((n) => somarMeses(atual, n));
  const totalProximas = somarValores(proximos3.map((m) => cartoes.aVencer[m] ?? 0));
  const comprometimentoCartoes = {
    totalProximas3Meses: totalProximas,
    rendaMediaMensal: rendaMedia,
    percentual: rendaMedia > 0 ? arredondar((totalProximas / (rendaMedia * 3)) * 100) : null,
  };

  // Parcelas futuras
  const porMes = Object.entries(cartoes.parcelas).sort(([x], [y]) => x.localeCompare(y)).map(([mes, total]) => ({ mes, total }));
  const parcelasFuturas = { total: somarValores(porMes.map((p) => p.total)), porMes };

  // Reserva de emergência
  const saldoReserva = await saldoAcumulado(usuarioId, hoje, true);
  const temReserva = (await pool.query(
    'SELECT 1 FROM fontes_destinos WHERE usuario_id = $1 AND reserva = true LIMIT 1', [usuarioId])).rowCount > 0;
  const reservaEmergencia = {
    temReserva,
    saldoReserva: arredondar(saldoReserva),
    mesesCobertos: temReserva && saidasMedia > 0 ? arredondar(saldoReserva / saidasMedia) : null,
  };

  // Categorias fora da curva (mês corrente × média dos 3 anteriores)
  const porCategoria = await totalPorCategoriaEMes(usuarioId, anteriores[0], atual);
  const categoriasForaDaCurva = [];
  for (const nome of new Set(porCategoria.map((r) => r.nome))) {
    const doNome = (m) => porCategoria.find((r) => r.nome === nome && r.mes === m)?.total ?? 0;
    const mediaCat = media(anteriores.map(doNome));
    const atualCat = doNome(atual);
    if (mediaCat > 0 && atualCat > mediaCat * (1 + LIMITES.foraDaCurva / 100)) {
      categoriasForaDaCurva.push({
        categoria: nome, atual: atualCat, media: mediaCat,
        percentualAcima: arredondar(((atualCat - mediaCat) / mediaCat) * 100),
      });
    }
  }

  // Projeção de 6 meses: média das entradas − saídas fora do cartão − faturas já conhecidas
  const saldoAtual = arredondar((await saldoAcumulado(usuarioId, hoje)) - cartoes.vencido);
  let saldo = saldoAtual;
  const projecao = [1, 2, 3, 4, 5, 6].map((n) => {
    const mes = somarMeses(atual, n);
    const saidas = arredondar(saidasSemCartaoMedia + (cartoes.aVencer[mes] ?? 0));
    saldo = arredondar(saldo + rendaMedia - saidas);
    return { mes, entradas: rendaMedia, saidas, saldo };
  });

  const indicadores = { taxaPoupanca, comprometimentoCartoes, parcelasFuturas, reservaEmergencia, categoriasForaDaCurva };
  return { referencia: hoje, aviso: AVISO, saldoAtual, limites: LIMITES, indicadores, projecao, dicas: gerarDicas(indicadores, projecao) };
}

function gerarDicas(ind, projecao) {
  const dicas = [];
  const { mesAnterior, historico } = ind.taxaPoupanca;
  const nomeMes = extenso(historico[2].mes);

  if (mesAnterior === null) {
    dicas.push({ tipo: 'info', texto: 'Ainda não há renda registrada nos meses recentes. Cadastre suas entradas e saídas para ver análises mais completas.' });
  } else if (mesAnterior < LIMITES.poupancaMinima) {
    dicas.push({ tipo: 'alerta', texto: `Você guardou ${mesAnterior}% da sua renda em ${nomeMes}. Uma meta comum é guardar pelo menos ${LIMITES.poupancaMinima}%.` });
  } else {
    dicas.push({ tipo: 'ok', texto: `Você guardou ${mesAnterior}% da sua renda em ${nomeMes}. Continue assim!` });
  }

  const { percentual, totalProximas3Meses } = ind.comprometimentoCartoes;
  if (percentual !== null && totalProximas3Meses > 0) {
    dicas.push({
      tipo: percentual > LIMITES.comprometimentoMaximo ? 'alerta' : 'info',
      texto: `Suas faturas dos próximos 3 meses (${reais(totalProximas3Meses)}) comprometem ${percentual}% da sua renda média.`,
    });
  }
  if (ind.parcelasFuturas.total > 0) {
    const ultimo = ind.parcelasFuturas.porMes.at(-1).mes;
    dicas.push({ tipo: 'info', texto: `Você tem ${reais(ind.parcelasFuturas.total)} em parcelas a vencer até ${extenso(ultimo)}.` });
  }
  for (const c of ind.categoriasForaDaCurva) {
    dicas.push({ tipo: 'alerta', texto: `Seus gastos com ${c.categoria} estão ${c.percentualAcima}% acima da sua média dos últimos 3 meses.` });
  }
  const r = ind.reservaEmergencia;
  if (!r.temReserva) {
    dicas.push({ tipo: 'info', texto: 'Marque uma conta como "reserva de emergência" em Fontes/Destinos para acompanhar quantos meses de despesas ela cobre.' });
  } else if (r.mesesCobertos !== null) {
    dicas.push({
      tipo: r.mesesCobertos < LIMITES.reservaMinimaMeses ? 'alerta' : 'ok',
      texto: `Sua reserva cobre ${r.mesesCobertos.toLocaleString('pt-BR')} mês(es) de despesas. Uma referência comum é de 3 a 6 meses.`,
    });
  }
  const negativo = projecao.find((p) => p.saldo < 0);
  if (negativo) {
    dicas.push({ tipo: 'alerta', texto: `Pela projeção, seu saldo pode ficar negativo em ${extenso(negativo.mes)}. Revise seus gastos.` });
  }
  return dicas;
}
```

- [ ] **Step 4: Rota e registro**

`backend/src/routes/saude-financeira.routes.js`:
```js
import { Router } from 'express';
import * as SaudeFinanceira from '../models/saudeFinanceira.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await SaudeFinanceira.calcular(req.usuarioId));
});

export default router;
```

Em `backend/src/server.js`, adicionar:
```js
import saudeFinanceiraRoutes from './routes/saude-financeira.routes.js';
```
```js
app.use('/api/saude-financeira', autenticar, saudeFinanceiraRoutes);
```

- [ ] **Step 5: Rodar os testes**

Run: `cd backend && node --test test/saude.test.js`
Expected: PASS. Depois `npm test` completo: PASS. Se o teste de projeção divergir, confira se `saidasSemCartao` ignora lançamentos de cartão e se `rendaMedia`/`saidasSemCartaoMedia` usam só os 3 meses anteriores.

- [ ] **Step 6: Página do front-end**

`frontend/src/components/paginas/SaudeFinanceira.jsx`:
```jsx
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../services/api.js';
import { useCarregar } from '../../utils/useCarregar.js';
import { mesExtenso, moeda, percentual } from '../../utils/formatar.js';
import { Estado } from '../comuns/Estados.jsx';

const pct = (v) => (v === null || v === undefined ? '—' : percentual(v));

export default function SaudeFinanceira() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/saude-financeira'), []);
  const ind = dados?.indicadores;

  return (
    <section>
      <h2>Saúde financeira</h2>
      <p className="aviso" role="note">{dados?.aviso ?? 'As informações desta página são educativas e não constituem recomendação financeira profissional.'}</p>
      <Estado carregando={carregando} erro={erro} recarregar={recarregar}>
        {dados && (
          <>
            <div className="cards">
              <div className="card"><small>Taxa de poupança (mês anterior)</small><strong>{pct(ind.taxaPoupanca.mesAnterior)}</strong></div>
              <div className="card"><small>Faturas × renda (3 meses)</small><strong>{pct(ind.comprometimentoCartoes.percentual)}</strong></div>
              <div className="card"><small>Parcelas a vencer</small><strong>{moeda(ind.parcelasFuturas.total)}</strong></div>
              <div className="card"><small>Reserva de emergência</small>
                <strong>{ind.reservaEmergencia.mesesCobertos !== null
                  ? `${ind.reservaEmergencia.mesesCobertos.toLocaleString('pt-BR')} mês(es)` : '—'}</strong></div>
            </div>

            <h3>Dicas</h3>
            {dados.dicas.map((d, i) => <div key={i} className={`dica ${d.tipo}`}>{d.texto}</div>)}

            <h3 style={{ marginTop: '1.5rem' }}>Projeção de saldo (próximos 6 meses)</h3>
            <div className="grafico">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dados.projecao.map((p) => ({ ...p, rotulo: mesExtenso(p.mes) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rotulo" />
                  <YAxis tickFormatter={(v) => moeda(v)} width={100} />
                  <Tooltip formatter={(v) => moeda(v)} />
                  <ReferenceLine y={0} stroke="#b91c1c" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="saldo" name="Saldo projetado" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="estado">Projeção baseada na média dos últimos 3 meses e nas faturas já conhecidas. Saldo atual estimado: {moeda(dados.saldoAtual)}.</p>

            {ind.categoriasForaDaCurva.length > 0 && (
              <>
                <h3>Categorias fora da curva</h3>
                <table>
                  <thead><tr><th>Categoria</th><th className="num">Este mês</th><th className="num">Média (3 meses)</th><th className="num">Acima</th></tr></thead>
                  <tbody>
                    {ind.categoriasForaDaCurva.map((c) => (
                      <tr key={c.categoria}>
                        <td>{c.categoria}</td><td className="num">{moeda(c.atual)}</td>
                        <td className="num">{moeda(c.media)}</td><td className="num saida">{pct(c.percentualAcima)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </Estado>
    </section>
  );
}
```

Em `frontend/src/App.jsx`, importar `SaudeFinanceira` e adicionar dentro de `<Route element={<RotaProtegida />}>`:
```jsx
<Route path="/saude-financeira" element={<SaudeFinanceira />} />
```

- [ ] **Step 7: Verificar no navegador**

Run: `cd frontend && npm run build` (sem erros). Logado como Ana (seed): o aviso educativo aparece no topo, há 4 cartões de indicadores, dicas geradas e o gráfico de linha com 6 meses. Logado num usuário novo (sem dados): a página carrega sem erro e mostra a dica de início.

- [ ] **Step 8: Checkpoint de commit**

```bash
git add backend/src backend/test frontend/src
git commit -m "feat: página de saúde financeira (desafio)"
```

---

### Task 12: README, revisão de segurança e checklist final (seção 10.14 do PDF)

**Files:**
- Create: `README.md`
- Modify: nenhum arquivo de código, exceto correções que a revisão apontar.

**Interfaces:**
- Consumes: tudo das Tasks 1 a 11.
- Produces: README que permite subir o projeto do zero; checklist 10.14 verificado item a item.

- [ ] **Step 1: Escrever o README**

`README.md` (na raiz):
````markdown
# Controle Financeiro — Projeto 2 (Full Stack)

Aplicação de controle financeiro pessoal: API REST em Node.js/Express com PostgreSQL e SPA em React.

## Tecnologias
- **Back-end:** Node.js 24, Express 5, `pg` (pool de conexões), `bcrypt`, `jsonwebtoken`, `dotenv`, `cors`, `express-rate-limit`. Testes com `node:test`.
- **Front-end:** React, React Router, Vite, Recharts. HTTP com `fetch`; CSS puro.
- **Banco:** PostgreSQL 16 (via Docker).

## Como rodar do zero
Pré-requisitos: Node 20+ e Docker.

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

A projeção de 6 meses usa a média das entradas e das saídas fora do cartão dos 3 meses anteriores, somada às faturas já conhecidas (incluindo parcelas futuras). O saldo inicial é entradas − saídas (sem compras no cartão ainda não vencidas) − faturas já vencidas. As dicas são geradas por regras; não há API de IA. A página exibe aviso de que o conteúdo é educativo.
````

- [ ] **Step 2: Rodar toda a suíte**

Run: `cd backend && npm test`
Expected: todos os testes PASS (cpf, dinheiro, datas, calculoFatura, auth, cadastros, lancamentos, relatorios, saude).

- [ ] **Step 3: Revisão de segurança por busca**

Run (cada comando deve ser conferido):
```bash
# a) nenhum SQL com interpolação de dado do usuário (só as colunas fixas de lancamento.js e os placeholders $n)
grep -rn '\${' backend/src/models backend/src/routes | grep -i -E "select|insert|update|delete|where"
# b) senha_hash só aparece em usuario.js (leitura para login) e no schema/seed
grep -rn "senha_hash" backend/src backend/database
# c) .env fora do Git
git check-ignore backend/.env && git ls-files | grep -E "(^|/)\.env$" || echo "ok: .env não versionado"
# d) nenhuma rota usa id de usuário vindo do corpo ou da URL
grep -rn "usuarioId\|usuario_id" backend/src/routes | grep -v "req.usuarioId"
```
Expected:
- (a) apenas linhas com `${where}`, `${SELECT}`, `${COLUNAS}`, `${n + 1}` e `$${params.length}` (fragmentos construídos no código, nunca texto do usuário). Qualquer outra ocorrência deve ser corrigida para parâmetro.
- (b) `usuario.js` (SELECT/INSERT), `schema.sql` e nada em `routes/`.
- (c) `backend/.env` ignorado; mensagem `ok: .env não versionado`.
- (d) nenhuma saída.

- [ ] **Step 4: Checklist 10.14 — itens cobertos por teste automatizado**

Confirme com a suíte verde (Step 2) que estes testes existem e passam:

| Item do PDF | Teste |
|---|---|
| Mesmo e-mail com maiúsculas diferentes é rejeitado | `auth.test.js` — "e-mail repetido com maiúsculas diferentes" |
| Mesmo CPF com e sem pontuação é rejeitado | `auth.test.js` — "CPF repetido com pontuação" |
| Sem verificação prévia no código, não há duplicatas (garantia do banco) | `auth.test.js` — "corrida: dois cadastros simultâneos"; o código de `auth.routes.js` não faz consulta prévia |
| Nenhuma resposta contém `senha_hash` | `auth.test.js` (cadastro, login e `/me`) |
| Trocar o id na URL não dá acesso a dados de outro usuário | `cadastros.test.js` e `lancamentos.test.js` — "isolamento" |
| Saída não aceita categoria de entrada | `lancamentos.test.js` — "saída com categoria de entrada" |
| R$ 100,00 em 3× soma exatamente R$ 100,00 | `dinheiro.test.js` e `lancamentos.test.js` — "compra parcelada" |
| Compra no dia do fechamento cai na fatura do mês seguinte | `calculoFatura.test.js` (Tabela 10.3) e `relatorios.test.js` — "previsão de faturas" |

- [ ] **Step 5: Checklist 10.14 — itens verificados manualmente**

Com banco semeado, back-end e front-end no ar:
1. **Token expirado volta ao login sem erro na tela:** logado, no DevTools → Application → Local Storage, troque o valor de `token` por `lixo` e navegue para Lançamentos. Esperado: redireciona ao login sem mensagem de erro quebrada.
2. **Requisição sem token → 401:** `curl -i http://localhost:3000/api/lancamentos` → `401` com `{"erro":"Token não informado."}`.
3. **Isolamento na apresentação (RF3):** faça login como Ana e Bruno (`curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"ana@exemplo.com","senha":"Senha1234"}'`), pegue o id de um lançamento de Ana (`GET /api/lancamentos`) e consulte com o token de Bruno: `curl -i -H "Authorization: Bearer <token-bruno>" http://localhost:3000/api/lancamentos/<id-da-ana>` → `404`. Repita com `PUT` e `DELETE`.
4. **`.env` não versionado, `.env.example` versionado:** `git ls-files | grep env` mostra só `backend/.env.example`.
5. **README sobe do zero:** em outra pasta (ou após `docker compose down -v` e apagar `backend/.env`), siga o README linha a linha. Esperado: aplicação funcional com os usuários do seed.
6. **Rate limit do login:** execute 11 logins errados seguidos (`for i in $(seq 1 11); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"x@x.com","senha":"errada123"}'; done`). Esperado: dez `401` e o 11º `429`.

- [ ] **Step 6: Ensaio do roteiro de apresentação (seção 10.11, até 10 minutos)**

Percorra, cronometrando: (1) estrutura de pastas e DDL; (2) `docker compose up -d`, `npm run db:schema`, `npm run db:seed`, back e front no ar; (3) cadastro com e-mail e depois CPF duplicados, mensagem no campo certo; (4) login, acesso a dado de outro usuário (404) e requisição sem token (401); (5) CRUD de categorias, fontes e lançamentos, incluindo compra parcelada no cartão; (6) relatórios por categoria e fonte/destino e a fatura em que caiu cada parcela da compra do item 5; (7) saúde financeira. Ajuste o que passar do tempo.

- [ ] **Step 7: Checkpoint de commit final**

```bash
git add README.md
git commit -m "docs: README completo e revisão final"
```
Lembrete ao grupo: o PDF exige commits incrementais de **ambos** os integrantes; revezem os commits e pushes entre as tarefas.
