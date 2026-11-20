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
