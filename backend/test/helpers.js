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
