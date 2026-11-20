import { pool } from '../config/db.js';

export const PADRAO = [
  ['Salário', 'entrada'], ['Outros', 'entrada'],
  ['Alimentação', 'saida'], ['Moradia', 'saida'], ['Saúde', 'saida'], ['Mobilidade', 'saida'],
  ['Lazer', 'saida'], ['Educação', 'saida'], ['Outros', 'saida'],
];

const mapa = (r) => ({ id: r.id, nome: r.nome, tipo: r.tipo });

export async function criarPadrao(usuarioId, exec = pool) {
  for (const [nome, tipo] of PADRAO) {
    await exec.query('INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3)', [usuarioId, nome, tipo]);
  }
}

export async function listar(usuarioId) {
  const { rows } = await pool.query(
    'SELECT id, nome, tipo FROM categorias WHERE usuario_id = $1 ORDER BY tipo, nome', [usuarioId]);
  return rows.map(mapa);
}

export async function buscar(usuarioId, id) {
  const { rows } = await pool.query(
    'SELECT id, nome, tipo FROM categorias WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rows[0] ? mapa(rows[0]) : null;
}

export async function criar(usuarioId, { nome, tipo }) {
  const { rows } = await pool.query(
    'INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id, nome, tipo',
    [usuarioId, nome, tipo]);
  return mapa(rows[0]);
}

export async function atualizar(usuarioId, id, { nome, tipo }) {
  const { rows } = await pool.query(
    'UPDATE categorias SET nome = $3, tipo = $4 WHERE id = $1 AND usuario_id = $2 RETURNING id, nome, tipo',
    [id, usuarioId, nome, tipo]);
  return rows[0] ? mapa(rows[0]) : null;
}

export async function contarLancamentos(usuarioId, id) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM lancamentos WHERE categoria_id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rows[0].n;
}

export async function excluir(usuarioId, id) {
  const r = await pool.query('DELETE FROM categorias WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return r.rowCount > 0;
}
