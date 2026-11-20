import { pool } from '../config/db.js';
import { calcularFatura, listarFaturas } from './calculoFatura.js';
import { hojeISO } from './datas.js';
import { arredondar, deCentavos, paraCentavos, somarValores } from './dinheiro.js';

// Para cada cartão do usuário, as compras (saídas) já com a fatura em que cada parcela cai.
async function carregar(usuarioId) {
  const { rows: cartoes } = await pool.query(
    `SELECT id, nome, dia_fechamento, dia_vencimento, limite
       FROM fontes_destinos WHERE usuario_id = $1 AND tipo = 'cartao_credito' ORDER BY nome`, [usuarioId]);
  const resultado = [];
  for (const cartao of cartoes) {
    const regra = { diaFechamento: cartao.dia_fechamento, diaVencimento: cartao.dia_vencimento };
    const { rows } = await pool.query(
      `SELECT l.id, l.descricao, l.valor, l.data, l.parcela_atual, l.total_parcelas, c.nome AS categoria_nome
         FROM lancamentos l JOIN categorias c ON c.id = l.categoria_id
        WHERE l.usuario_id = $1 AND l.fonte_destino_id = $2 AND l.tipo = 'saida'
        ORDER BY l.data, l.id`, [usuarioId, cartao.id]);
    const itens = rows.map((r) => ({ ...r, fatura: calcularFatura(r.data, regra, r.parcela_atual) }));
    resultado.push({ cartao, regra, itens });
  }
  return resultado;
}

export async function previsao(usuarioId, meses, hoje = hojeISO()) {
  const cartoes = await carregar(usuarioId);
  return cartoes.map(({ cartao, regra, itens }) => {
    const faturas = listarFaturas(hoje, regra, meses + 1).map((f, i) => {
      const lancamentos = itens
        .filter((x) => x.fatura.referencia === f.referencia)
        .map((x) => ({
          id: x.id, descricao: x.descricao, valor: x.valor, data: x.data,
          parcelaAtual: x.parcela_atual, totalParcelas: x.total_parcelas, categoriaNome: x.categoria_nome,
        }));
      return { ...f, atual: i === 0, total: somarValores(lancamentos.map((l) => l.valor)), lancamentos };
    });
    // O limite fica comprometido pelo total das parcelas ainda não vencidas.
    const utilizado = somarValores(itens.filter((x) => x.fatura.vencimento >= hoje).map((x) => x.valor));
    return {
      cartaoId: cartao.id,
      nome: cartao.nome,
      limite: cartao.limite,
      diaFechamento: cartao.dia_fechamento,
      diaVencimento: cartao.dia_vencimento,
      limiteUtilizado: utilizado,
      limiteDisponivel: arredondar(cartao.limite - utilizado),
      faturas,
    };
  });
}

// Totais de todos os cartões: o que já venceu e o que vence por mês (para a saúde financeira).
export async function resumo(usuarioId, hoje = hojeISO()) {
  let vencido = 0;
  const aVencer = {};
  const parcelas = {};
  for (const { itens } of await carregar(usuarioId)) {
    for (const x of itens) {
      const centavos = paraCentavos(x.valor);
      if (x.fatura.vencimento < hoje) {
        vencido += centavos;
      } else {
        aVencer[x.fatura.referencia] = (aVencer[x.fatura.referencia] ?? 0) + centavos;
        if (x.total_parcelas > 1) parcelas[x.fatura.referencia] = (parcelas[x.fatura.referencia] ?? 0) + centavos;
      }
    }
  }
  const emReais = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, deCentavos(v)]));
  return { vencido: deCentavos(vencido), aVencer: emReais(aVencer), parcelas: emReais(parcelas) };
}
