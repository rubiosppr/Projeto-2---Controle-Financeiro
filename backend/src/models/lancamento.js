import { randomUUID } from 'node:crypto';
import { pool, transacao } from '../config/db.js';
import { arredondar, dividirParcelas } from './dinheiro.js';

const mapa = (r) => ({
  id: r.id,
  tipo: r.tipo,
  descricao: r.descricao,
  valor: r.valor,
  data: r.data,
  categoriaId: r.categoria_id,
  categoriaNome: r.categoria_nome,
  fonteDestinoId: r.fonte_destino_id,
  fonteDestinoNome: r.fonte_destino_nome,
  parcelaAtual: r.parcela_atual,
  totalParcelas: r.total_parcelas,
  grupoParcelamento: r.grupo_parcelamento,
});

const SELECT = `SELECT l.*, c.nome AS categoria_nome, f.nome AS fonte_destino_nome
                  FROM lancamentos l
                  JOIN categorias c ON c.id = l.categoria_id
                  JOIN fontes_destinos f ON f.id = l.fonte_destino_id`;

function filtrar(usuarioId, f) {
  const condicoes = ['l.usuario_id = $1', 'l.data BETWEEN $2 AND $3'];
  const params = [usuarioId, f.inicio, f.fim];
  for (const [campo, coluna] of [['tipo', 'l.tipo'], ['categoriaId', 'l.categoria_id'], ['fonteDestinoId', 'l.fonte_destino_id']]) {
    if (f[campo] != null) {
      params.push(f[campo]);
      condicoes.push(`${coluna} = $${params.length}`);
    }
  }
  return { where: condicoes.join(' AND '), params };
}

export async function listar(usuarioId, f) {
  const { where, params } = filtrar(usuarioId, f);
  const resumo = await pool.query(
    `SELECT COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'), 0) AS entradas,
            COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'), 0) AS saidas,
            COUNT(*)::int AS total
       FROM lancamentos l WHERE ${where}`, params);
  const { entradas, saidas, total } = resumo.rows[0];

  const n = params.length;
  const { rows } = await pool.query(
    `${SELECT} WHERE ${where} ORDER BY l.data DESC, l.id DESC LIMIT $${n + 1} OFFSET $${n + 2}`,
    [...params, f.limite, (f.pagina - 1) * f.limite]);

  return {
    itens: rows.map(mapa),
    totais: { entradas, saidas, saldo: arredondar(entradas - saidas) },
    paginacao: { pagina: f.pagina, limite: f.limite, total, paginas: Math.max(1, Math.ceil(total / f.limite)) },
  };
}

export async function buscar(usuarioId, id) {
  const { rows } = await pool.query(`${SELECT} WHERE l.id = $1 AND l.usuario_id = $2`, [id, usuarioId]);
  return rows[0] ? mapa(rows[0]) : null;
}

// Uma linha por parcela, todas na mesma transação (todas gravadas ou nenhuma).
export async function criar(usuarioId, d) {
  const valores = dividirParcelas(d.valor, d.totalParcelas);
  const grupo = d.totalParcelas > 1 ? randomUUID() : null;
  return transacao(async (client) => {
    const criados = [];
    for (let i = 0; i < valores.length; i += 1) {
      const { rows } = await client.query(
        `INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id,
                                  parcela_atual, total_parcelas, grupo_parcelamento)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [usuarioId, d.tipo, d.descricao, valores[i], d.data, d.categoriaId, d.fonteDestinoId,
          i + 1, d.totalParcelas, grupo]);
      criados.push(mapa(rows[0]));
    }
    return criados;
  });
}

export async function atualizar(usuarioId, id, d) {
  const { rowCount } = await pool.query(
    `UPDATE lancamentos
        SET tipo = $3, descricao = $4, valor = $5, data = $6, categoria_id = $7, fonte_destino_id = $8
      WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId, d.tipo, d.descricao, d.valor, d.data, d.categoriaId, d.fonteDestinoId]);
  return rowCount > 0 ? buscar(usuarioId, id) : null;
}

export async function excluir(usuarioId, id, todasParcelas) {
  const l = await buscar(usuarioId, id);
  if (!l) return false;
  if (todasParcelas && l.grupoParcelamento) {
    await pool.query('DELETE FROM lancamentos WHERE usuario_id = $1 AND grupo_parcelamento = $2',
      [usuarioId, l.grupoParcelamento]);
  } else {
    await pool.query('DELETE FROM lancamentos WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  }
  return true;
}
