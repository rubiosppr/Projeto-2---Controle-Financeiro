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

test('descrição com byte nulo é 400, não 500', async () => {
  const r = await criar(novo({ descricao: 'a\u0000b' }));
  assert.equal(r.status, 400);
});
