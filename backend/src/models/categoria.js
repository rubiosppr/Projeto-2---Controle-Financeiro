import { pool } from '../config/db.js';

export const PADRAO = [
  ['Salário', 'entrada'], ['Outros', 'entrada'],
  ['Alimentação', 'saida'], ['Moradia', 'saida'], ['Saúde', 'saida'], ['Mobilidade', 'saida'],
  ['Lazer', 'saida'], ['Educação', 'saida'], ['Outros', 'saida'],
];

export async function criarPadrao(usuarioId, exec = pool) {
  for (const [nome, tipo] of PADRAO) {
    await exec.query('INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3)', [usuarioId, nome, tipo]);
  }
}
