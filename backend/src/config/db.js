import pg from 'pg';
import { env } from './env.js';

pg.types.setTypeParser(1700, (v) => Number(v)); // NUMERIC -> number
pg.types.setTypeParser(1082, (v) => v);         // DATE -> 'AAAA-MM-DD' (sem fuso)

export const pool = new pg.Pool({ connectionString: env.databaseUrl, max: 10 });

export const consultar = (sql, params) => pool.query(sql, params);

export async function transacao(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}
