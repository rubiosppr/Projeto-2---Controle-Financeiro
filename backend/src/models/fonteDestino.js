import { pool } from '../config/db.js';

export async function criarPadrao(usuarioId, exec = pool) {
  await exec.query(
    "INSERT INTO fontes_destinos (usuario_id, nome, tipo) VALUES ($1, 'Conta corrente', 'conta')",
    [usuarioId],
  );
}
