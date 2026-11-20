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
