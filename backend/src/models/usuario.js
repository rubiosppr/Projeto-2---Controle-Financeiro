import { pool } from '../config/db.js';

export async function criar({ nome, email, cpf, senhaHash }, exec = pool) {
  const { rows } = await exec.query(
    'INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES ($1, $2, $3, $4) RETURNING id, nome, email',
    [nome, email, cpf, senhaHash],
  );
  return rows[0];
}

export async function buscarPorEmail(email) {
  const { rows } = await pool.query('SELECT id, nome, email, senha_hash FROM usuarios WHERE email = $1', [email]);
  return rows[0] ?? null;
}

export async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT id, nome, email FROM usuarios WHERE id = $1', [id]);
  return rows[0] ?? null;
}
