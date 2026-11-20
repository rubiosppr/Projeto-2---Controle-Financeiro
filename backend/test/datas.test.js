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
