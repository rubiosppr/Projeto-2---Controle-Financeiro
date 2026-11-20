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
