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
