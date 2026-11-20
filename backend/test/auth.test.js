import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { iniciar, encerrar, requisitar, pool, gerarCpf, criarUsuario } from './helpers.js';

before(iniciar);
after(encerrar);

const cpfA = gerarCpf('529982247');
const cadastroValido = { nome: 'Ana', email: 'ana@email.com', cpf: cpfA, senha: 'Senha1234', confirmarSenha: 'Senha1234' };

test('cadastro válido: 201, sem senha_hash, cria categorias e fonte padrão', async () => {
  const r = await requisitar('POST', '/auth/cadastro', { corpo: cadastroValido });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.email, 'ana@email.com');
  assert.equal(JSON.stringify(r.corpo).includes('senha'), false);
  const cats = await pool.query('SELECT COUNT(*)::int AS n FROM categorias WHERE usuario_id = $1', [r.corpo.id]);
  const fontes = await pool.query('SELECT COUNT(*)::int AS n FROM fontes_destinos WHERE usuario_id = $1', [r.corpo.id]);
  assert.equal(cats.rows[0].n, 9);
  assert.equal(fontes.rows[0].n, 1);
});

test('senha é gravada como hash bcrypt', async () => {
  const { rows } = await pool.query("SELECT senha_hash FROM usuarios WHERE email = 'ana@email.com'");
  assert.match(rows[0].senha_hash, /^\$2[aby]\$/);
});

test('e-mail repetido com maiúsculas diferentes: 409 no campo email', async () => {
  const r = await requisitar('POST', '/auth/cadastro', {
    corpo: { ...cadastroValido, email: '  ANA@Email.com ', cpf: gerarCpf('111222333') },
  });
  assert.equal(r.status, 409);
  assert.ok(r.corpo.campos.email);
  assert.equal(r.corpo.campos.cpf, undefined);
});

test('CPF repetido com pontuação: 409 no campo cpf', async () => {
  const formatado = cpfA.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  const r = await requisitar('POST', '/auth/cadastro', {
    corpo: { ...cadastroValido, email: 'outra@email.com', cpf: formatado },
  });
  assert.equal(r.status, 409);
  assert.ok(r.corpo.campos.cpf);
});

test('corrida: dois cadastros simultâneos com o mesmo e-mail geram um 201 e um 409', async () => {
  const corpo = (cpf) => ({ nome: 'Corrida', email: 'corrida@email.com', cpf, senha: 'Senha1234' });
  const [a, b] = await Promise.all([
    requisitar('POST', '/auth/cadastro', { corpo: corpo(gerarCpf('222333444')) }),
    requisitar('POST', '/auth/cadastro', { corpo: corpo(gerarCpf('333444555')) }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
});

test('validações do cadastro: 400 com campos', async () => {
  const r = await requisitar('POST', '/auth/cadastro', {
    corpo: { nome: '', email: 'x', cpf: '52998224724', senha: 'abc', confirmarSenha: 'outra' },
  });
  assert.equal(r.status, 400);
  assert.equal(r.corpo.erro, 'Dados inválidos.');
  for (const campo of ['nome', 'email', 'cpf', 'senha', 'confirmarSenha']) assert.ok(r.corpo.campos[campo], campo);
});

test('senha só com letras ou só com números é rejeitada', async () => {
  for (const senha of ['somenteletras', '1234567890']) {
    const r = await requisitar('POST', '/auth/cadastro', { corpo: { ...cadastroValido, senha, confirmarSenha: senha } });
    assert.equal(r.status, 400);
    assert.ok(r.corpo.campos.senha);
  }
});

test('Review Focus 1: corpo ausente e JSON malformado dão 400, não 500', async () => {
  const semCorpo = await requisitar('POST', '/auth/cadastro');
  assert.equal(semCorpo.status, 400);
  assert.ok(semCorpo.corpo.campos);
  const malformado = await requisitar('POST', '/auth/login', { bruto: '{"email": ' });
  assert.equal(malformado.status, 400);
  assert.ok(malformado.corpo.erro);
});

test('login: sucesso devolve token e usuário; falhas têm mensagem genérica idêntica', async () => {
  const ok = await requisitar('POST', '/auth/login', { corpo: { email: 'ANA@email.com', senha: 'Senha1234' } });
  assert.equal(ok.status, 200);
  assert.ok(ok.corpo.token);
  assert.equal(ok.corpo.usuario.email, 'ana@email.com');
  assert.equal(JSON.stringify(ok.corpo).includes('senha'), false);

  const senhaErrada = await requisitar('POST', '/auth/login', { corpo: { email: 'ana@email.com', senha: 'Errada123' } });
  const emailInexistente = await requisitar('POST', '/auth/login', { corpo: { email: 'nao@existe.com', senha: 'Senha1234' } });
  assert.equal(senhaErrada.status, 401);
  assert.equal(emailInexistente.status, 401);
  assert.deepEqual(senhaErrada.corpo, emailInexistente.corpo);
  assert.equal(senhaErrada.corpo.erro, 'E-mail ou senha inválidos.');
});

test('login sem campos: 400', async () => {
  const r = await requisitar('POST', '/auth/login', { corpo: {} });
  assert.equal(r.status, 400);
  assert.ok(r.corpo.campos.email && r.corpo.campos.senha);
});

test('/auth/me: sem token 401, token inválido 401, expirado 401, válido 200', async () => {
  const u = await criarUsuario();
  assert.equal((await requisitar('GET', '/auth/me')).status, 401);
  assert.equal((await requisitar('GET', '/auth/me', { token: 'lixo' })).status, 401);
  const expirado = jwt.sign({}, process.env.JWT_SECRET, { subject: String(u.id), expiresIn: -10 });
  assert.equal((await requisitar('GET', '/auth/me', { token: expirado })).status, 401);
  const ok = await requisitar('GET', '/auth/me', { token: u.token });
  assert.equal(ok.status, 200);
  assert.equal(ok.corpo.id, u.id);
  assert.equal(JSON.stringify(ok.corpo).includes('senha'), false);
});

test('rota inexistente devolve 404 no padrão de erro', async () => {
  const r = await requisitar('GET', '/nao-existe');
  assert.equal(r.status, 404);
  assert.ok(r.corpo.erro);
});

test('CORS: origem estranha não é autorizada', async () => {
  const r = await requisitar('GET', '/auth/me', { headers: { Origin: 'http://evil.example' } });
  assert.notEqual(r.headers.get('access-control-allow-origin'), 'http://evil.example');
  const ok = await requisitar('GET', '/auth/me', { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});
