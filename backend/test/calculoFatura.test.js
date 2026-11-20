import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularFatura, faturaAnterior, listarFaturas } from '../src/models/calculoFatura.js';

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

test('faturaAnterior: fatura do mês anterior à aberta na data', () => {
  assert.deepEqual(faturaAnterior('2026-11-28', visa), {
    referencia: '2026-12', fechamento: '2026-11-25', vencimento: '2026-12-05',
  });
  assert.deepEqual(faturaAnterior('2026-11-20', nubank), {
    referencia: '2026-11', fechamento: '2026-11-03', vencimento: '2026-11-10',
  });
});
