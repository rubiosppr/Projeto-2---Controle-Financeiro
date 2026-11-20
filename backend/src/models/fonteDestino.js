import { pool } from '../config/db.js';

const COLUNAS = 'id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva';
const mapa = (r) => ({
  id: r.id, nome: r.nome, tipo: r.tipo,
  diaFechamento: r.dia_fechamento, diaVencimento: r.dia_vencimento,
  limite: r.limite, reserva: r.reserva,
});

export async function criarPadrao(usuarioId, exec = pool) {
  await exec.query(
    "INSERT INTO fontes_destinos (usuario_id, nome, tipo) VALUES ($1, 'Conta corrente', 'conta')",
    [usuarioId],
  );
}

export async function listar(usuarioId) {
  const { rows } = await pool.query(
    `SELECT ${COLUNAS} FROM fontes_destinos WHERE usuario_id = $1 ORDER BY tipo, nome`, [usuarioId]);
  return rows.map(mapa);
}

export async function buscar(usuarioId, id) {
  const { rows } = await pool.query(
    `SELECT ${COLUNAS} FROM fontes_destinos WHERE id = $1 AND usuario_id = $2`, [id, usuarioId]);
  return rows[0] ? mapa(rows[0]) : null;
}

export async function criar(usuarioId, d) {
  const { rows } = await pool.query(
    `INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUNAS}`,
    [usuarioId, d.nome, d.tipo, d.diaFechamento, d.diaVencimento, d.limite, d.reserva]);
  return mapa(rows[0]);
}

export async function atualizar(usuarioId, id, d) {
  const { rows } = await pool.query(
    `UPDATE fontes_destinos
        SET nome = $3, tipo = $4, dia_fechamento = $5, dia_vencimento = $6, limite = $7, reserva = $8
      WHERE id = $1 AND usuario_id = $2 RETURNING ${COLUNAS}`,
    [id, usuarioId, d.nome, d.tipo, d.diaFechamento, d.diaVencimento, d.limite, d.reserva]);
  return rows[0] ? mapa(rows[0]) : null;
}

export async function contarLancamentos(usuarioId, id) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM lancamentos WHERE fonte_destino_id = $1 AND usuario_id = $2', [id, usuarioId]);
  return rows[0].n;
}

export async function excluir(usuarioId, id) {
  const r = await pool.query('DELETE FROM fontes_destinos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return r.rowCount > 0;
}
