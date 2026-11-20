import { pool } from '../config/db.js';
import { periodoAnterior } from './datas.js';
import { arredondar, percentual, somarValores } from './dinheiro.js';

async function totaisPorCategoria(usuarioId, tipo, inicio, fim) {
  const { rows } = await pool.query(
    `SELECT c.id, c.nome, SUM(l.valor) AS total
       FROM lancamentos l
       JOIN categorias c ON c.id = l.categoria_id
      WHERE l.usuario_id = $1 AND l.tipo = $2 AND l.data BETWEEN $3 AND $4
      GROUP BY c.id, c.nome
      ORDER BY total DESC, c.nome`,
    [usuarioId, tipo, inicio, fim]);
  return rows.map((r) => ({ id: r.id, nome: r.nome, total: r.total }));
}

export async function categorias(usuarioId, { inicio, fim }) {
  const anterior = periodoAnterior(inicio, fim);
  const [saidas, entradas, saidasAnteriores] = await Promise.all([
    totaisPorCategoria(usuarioId, 'saida', inicio, fim),
    totaisPorCategoria(usuarioId, 'entrada', inicio, fim),
    totaisPorCategoria(usuarioId, 'saida', anterior.inicio, anterior.fim),
  ]);

  const totalSaidas = somarValores(saidas.map((s) => s.total));
  const totalEntradas = somarValores(entradas.map((e) => e.total));
  const anteriorPorId = new Map(saidasAnteriores.map((s) => [s.id, s.total]));

  const lista = saidas.map((s) => {
    const ant = anteriorPorId.get(s.id) ?? 0;
    return { ...s, percentual: percentual(s.total, totalSaidas), periodoAnterior: ant, variacao: arredondar(s.total - ant) };
  });
  for (const ant of saidasAnteriores) { // existia antes e sumiu: mostra a redução
    if (!saidas.some((s) => s.id === ant.id)) {
      lista.push({ id: ant.id, nome: ant.nome, total: 0, percentual: 0, periodoAnterior: ant.total, variacao: -ant.total });
    }
  }
  lista.sort((x, y) => y.total - x.total || x.nome.localeCompare(y.nome));

  return {
    periodo: { inicio, fim },
    periodoAnterior: anterior,
    totalSaidas,
    totalEntradas,
    categorias: lista,
    entradas,
  };
}

export async function fontesDestinos(usuarioId, { inicio, fim }) {
  const { rows } = await pool.query(
    `SELECT f.id, f.nome, f.tipo,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'entrada'), 0) AS entradas,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'saida'), 0) AS saidas
       FROM fontes_destinos f
       LEFT JOIN lancamentos l
              ON l.fonte_destino_id = f.id AND l.usuario_id = $1 AND l.data BETWEEN $2 AND $3
      WHERE f.usuario_id = $1
      GROUP BY f.id, f.nome, f.tipo
      ORDER BY f.tipo, f.nome`,
    [usuarioId, inicio, fim]);
  return {
    periodo: { inicio, fim },
    itens: rows.map((r) => ({
      id: r.id, nome: r.nome, tipo: r.tipo, entradas: r.entradas, saidas: r.saidas,
      saldo: r.tipo === 'conta' ? arredondar(r.entradas - r.saidas) : null,
    })),
  };
}
