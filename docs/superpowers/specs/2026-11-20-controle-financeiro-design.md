# Controle Financeiro Full Stack — Design

Data: 2026-11-20
Fonte dos requisitos: `Projeto2-Controle-Financeiro.pdf` (enunciado do Projeto 2). Em caso de conflito, o PDF vale.

## 1. Objetivo e decisões já tomadas

Aplicação full stack de controle financeiro pessoal: API REST própria (Node.js + Express + PostgreSQL) e SPA em React que a consome. Entrega avaliada em 100 pontos + 10 do desafio (saúde financeira).

Decisões confirmadas com o usuário:
- **Banco:** PostgreSQL, subido via Docker (`docker-compose.yml`). Precisa ser comunicado ao professor antes do desenvolvimento.
- **Desafio:** será feito, na última fase, para não atrasar o núcleo de 100 pontos.
- **Idioma:** código de domínio, rotas e mensagens em português, como no enunciado.
- **Bibliotecas** (lista mínima; qualquer outra precisa de aprovação do professor):
  - Back-end: `express`, `pg`, `bcrypt`, `jsonwebtoken`, `dotenv`, `cors`, `express-rate-limit`. Validação escrita à mão, sem biblioteca. Testes com `node:test`.
  - Front-end: `react`, `react-router-dom`, `vite`, `recharts`. HTTP com `fetch` (sem Axios). CSS puro.

Fora do escopo: deploy, recuperação de senha, refresh token, tema escuro, i18n.

## 2. Estrutura do repositório

```
projeto2-financas/
├── docker-compose.yml          # só o Postgres
├── README.md
├── backend/
│   ├── package.json
│   ├── .env.example            # PORT, DATABASE_URL, JWT_SECRET, CORS_ORIGIN...
│   ├── database/               # schema.sql, seed.js
│   └── src/
│       ├── server.js
│       ├── routes/             # rotas + controladores (sem pasta controllers)
│       ├── models/             # acesso ao banco + utilitários puros
│       ├── middlewares/        # autenticar, validar, erros, limitadorLogin
│       └── config/             # db (Pool), jwt, env
└── frontend/
    ├── package.json
    └── src/
        ├── components/         # páginas e componentes (JSX)
        ├── contexts/           # AuthContext
        ├── services/           # api.js (único ponto de acesso à API)
        └── utils/              # formatar, máscaras, cpf
```

Dentro de `backend/src/` existem apenas `server.js` e as quatro subpastas. Utilitários puros (`cpf.js`, `fatura.js` com `calcularFatura`, `dinheiro.js`) ficam em `models/` e isso é documentado no README.

## 3. Back-end

### 3.1 Banco
DDL do PDF (seção 10.4), com uma adição: `reserva BOOLEAN NOT NULL DEFAULT false` em `fontes_destinos`, usada pelo desafio. Conexão por `pg.Pool`; todas as consultas parametrizadas.

### 3.2 Regras transversais
- **Dinheiro:** `NUMERIC(12,2)` no banco; cálculos de parcela e percentual em centavos inteiros no JS; API devolve números com 2 casas.
- **Isolamento (RF3):** todo model recebe `usuarioId` (de `req.usuarioId`, vindo do token) e filtra por ele. Registro de outro usuário → 404. Ao criar/editar lançamento, categoria e fonte/destino devem ser do mesmo usuário, e o tipo da categoria deve ser igual ao do lançamento.
- **Unicidade:** UNIQUE no banco. Cadastro captura `23505` e responde 409 com `campos` indicando e-mail ou CPF. E-mail normalizado com `trim().toLowerCase()`, CPF só com dígitos.
- **Autenticação:** senha com `bcrypt` (custo 10); JWT de 1h com `sub = id`; middleware `autenticar` coloca `req.usuarioId`; token ausente/inválido/expirado → 401. `senha_hash` nunca sai em resposta. Login com credenciais inválidas → 401 genérico ("E-mail ou senha inválidos").
- **Cadastro:** valida campos obrigatórios, e-mail, CPF com dígitos verificadores, senha ≥ 8 com letras e números; cria categorias padrão (Salário, Alimentação, Moradia, Saúde, Mobilidade, Lazer, Educação, Outros) e a fonte/destino "Conta corrente".
- **Erros:** middleware central; formato único `{ "erro": "...", "campos": { campo: "msg" } }`; 500 não vaza detalhes.
- **Segurança:** CORS restrito a `CORS_ORIGIN` (`http://localhost:5173`), rate limit no login, `.env` fora do Git e `.env.example` versionado.

### 3.3 Rotas
As da Tabela 10.5 do PDF: `/api/auth/{cadastro,login,me}`, `/api/categorias[/:id]`, `/api/fontes-destinos[/:id]`, `/api/lancamentos[/:id]`, `/api/relatorios/{categorias,fontes-destinos,faturas}`, `/api/saude-financeira`. Códigos de status conforme a tabela (201/204 em criação/exclusão, 400 validação, 404 inexistente ou de outro usuário, 409 conflito).

### 3.4 Categorias e fontes/destinos
- Nome único por usuário (categoria: por usuário+nome+tipo) → 409.
- Exclusão bloqueada com 409 se houver lançamentos vinculados.
- Fonte/destino tipo `cartao_credito` exige `dia_fechamento`, `dia_vencimento` (1–31) e `limite` → 400 se faltar.

### 3.5 Lançamentos
- Campos obrigatórios; valor > 0; data válida; tipo da categoria = tipo do lançamento.
- **Parcelamento:** somente se o destino for cartão; 1–48 parcelas. Uma linha por parcela, mesmo `grupo_parcelamento` (UUID), `parcela_atual` de 1 a N, tudo em **uma transação**. Divisão em centavos, sobra na primeira parcela (R$ 100,00 em 3× → 33,34 + 33,33 + 33,33).
- **Modelagem de parcelas:** todas as parcelas guardam a **data da compra**; a fatura é calculada com `calcularFatura(data, cartao, parcela_atual)`. Justificativa (a ser repetida no README): evita duplicar a regra de fechamento no banco e permite corrigir a regra sem migrar dados.
- **Listagem:** filtros `inicio`, `fim`, `tipo`, `categoriaId`, `fonteDestinoId`, `pagina`; padrão = mês corrente; resposta inclui totais de entradas, saídas e saldo do período filtrado.
- **Edição:** PUT/PATCH com as mesmas validações. **Exclusão:** `DELETE`, com `?todasParcelas=true` para apagar o grupo inteiro.

### 3.6 Relatórios
- **Por categoria (RF7):** `GROUP BY`/`SUM` no banco; saídas por categoria com percentual, ordenadas do maior para o menor; entradas por categoria; `periodoAnterior` de mesmo tamanho por categoria. Formato de resposta como no PDF.
- **Por fonte/destino (RF8):** entradas por fonte, saídas por destino, saldo por fonte/destino do tipo `conta`.
- **Faturas (RF9):** por cartão, fatura atual + próximas `meses` (mín. 3), com fechamento, vencimento, lançamentos (com indicação "k/N"), total, limite utilizado (soma das parcelas ainda não vencidas) e limite disponível. Regra de fechamento: compra antes do dia de fechamento entra na fatura do mês; no dia ou depois, na do mês seguinte; parcela k cai k−1 meses depois; dias inexistentes ajustados ao último dia do mês.

### 3.7 Desafio — saúde financeira
`GET /api/saude-financeira`, calculada no back-end. Mínimo de 3 indicadores (taxa de poupança, comprometimento com cartões, parcelas futuras; opcionais: 50/30/20, categoria fora da curva, reserva de emergência), uma projeção de saldo para 3–6 meses e dicas geradas por regras `if` com limites documentados no README. Sem API de LLM. A página mostra aviso visível de que o conteúdo é educativo e não é recomendação financeira.

## 4. Front-end

- **`services/api.js`:** wrapper de `fetch` que adiciona `Authorization: Bearer`; em 401 limpa a sessão e volta ao login sem erro na tela (via callback registrado pelo `AuthContext`); erros 400/409 viram `ApiErro { mensagem, campos }`.
- **`AuthContext`:** `usuario`, `token`, `login`, `logout`, `cadastrar`. Token em `localStorage`; ao recarregar, valida com `GET /api/auth/me`.
- **Rotas (React Router):** `/login` e `/cadastro` públicas; as demais sob `RotaProtegida`.
- **Telas:** Login, Cadastro (erro 409 junto ao campo certo), Dashboard (resumo do mês), Lançamentos (filtros, paginação, totais, modal de formulário com campo de parcelas só para cartão, exclusão com escolha "só esta / todas"), Categorias, Fontes/Destinos, Relatórios (por categoria com rosca Recharts e comparação; por fonte/destino com barras), Faturas, Saúde financeira.
- **Todas** as telas que consomem a API tratam carregando, lista vazia e erro.
- **Formatação:** BRL com `Intl.NumberFormat('pt-BR')`, datas dd/mm/aaaa, máscaras de CPF e valor. Validação no cliente é complementar.
- **Visual:** CSS puro, menu lateral, responsivo o suficiente para a demonstração.

## 5. Execução e entrega

- `docker compose up -d` sobe o Postgres; `schema.sql` aplicado na primeira subida e via `npm run db:schema`.
- `npm run db:seed`: 2 usuários (senha de demonstração no README), 3 meses de lançamentos, incluindo compra parcelada no cartão e compras em dia de fechamento.
- Back-end na porta 3000 e front-end na 5173 (`npm run dev` em cada pasta).
- README: tecnologias, banco, `.env`, seed, subir back e front, lista de rotas, justificativa das parcelas, local dos utilitários puros, regras das dicas.
- Git: `git init`, `.gitignore` (`.env`, `node_modules`, builds), commits incrementais por marco. O PDF exige commits de mais de um integrante; o grupo deve revezar commits/pushes. Commits só quando o usuário pedir.

## 6. Testes e verificação

- `node:test` nos utilitários puros: `cpfValido`, `calcularFatura` (os 4 exemplos da Tabela 10.3 + fevereiro/dia 31), divisão de centavos.
- Testes de integração das rotas contra um banco de teste: unicidade (e-mail com caixa diferente, CPF com/sem pontuação), isolamento entre usuários, tipo categoria × lançamento, parcelas somando o total, 401 sem token.
- Cada marco termina com testes passando e verificação real contra o Postgres no Docker. No fim, percorrer o checklist da seção 10.14 do PDF item por item.

## 7. Ordem de execução (marcos do PDF)

1. **Modelagem:** repo, docker, `schema.sql`, seed base, esqueleto de pastas.
2. **Autenticação:** cadastro com UNIQUE, login, JWT, rate limit, `AuthContext`, telas de login/cadastro.
3. **CRUD:** categorias, fontes/destinos, lançamentos (com parcelamento), back e front.
4. **Relatórios:** categoria, fonte/destino, faturas; telas e gráficos.
5. **Acabamento:** segurança, erros, README, checklist 10.14; depois o desafio de saúde financeira.
