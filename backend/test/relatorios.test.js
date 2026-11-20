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

test('previsão: fatura fechada e ainda não vencida é listada primeiro (fechada: true)', async () => {
  const Fatura = await import('../src/models/fatura.js');
  const u = await criarUsuario('FaturaFechada');
  const catsU = (await requisitar('GET', '/categorias', { token: u.token })).corpo;
  const visa = (await requisitar('POST', '/fontes-destinos', {
    token: u.token, corpo: { nome: 'Visa', tipo: 'cartao_credito', diaFechamento: 25, diaVencimento: 5, limite: 3000 },
  })).corpo;
  const catId = catsU.find((c) => c.nome === 'Alimentação' && c.tipo === 'saida').id;
  const l = (descricao, valor, data) => lancar(
    { tipo: 'saida', descricao, valor, data, categoriaId: catId, fonteDestinoId: visa.id }, u.token);
  await l('Antiga', 70, '2026-10-10');   // fatura de nov (vencida em 05/11)
  await l('Fechada', 300, '2026-11-10'); // fecha 25/11, vence 05/12
  await l('Aberta', 120, '2026-11-26');  // fecha 25/12, vence 05/01

  const [prev] = await Fatura.previsao(u.id, 2, '2026-11-28');
  assert.deepEqual(prev.faturas.map((f) => f.referencia), ['2026-12', '2027-01', '2027-02', '2027-03']);
  assert.equal(prev.faturas[0].fechada, true);
  assert.equal(prev.faturas[0].atual, false);
  assert.equal(prev.faturas[0].vencimento, '2026-12-05');
  assert.equal(prev.faturas[0].total, 300);
  assert.equal(prev.faturas[1].atual, true);
  assert.notEqual(prev.faturas[1].fechada, true);
  assert.equal(prev.faturas[1].total, 120);
  assert.equal(prev.limiteUtilizado, 420);
});
