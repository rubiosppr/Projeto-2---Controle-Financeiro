import { pool } from '../config/db.js';
import * as Fatura from './fatura.js';
import { hojeISO, somarMeses } from './datas.js';
import { arredondar, somarValores } from './dinheiro.js';

// Limites usados pelas dicas (documentados no README).
export const LIMITES = {
  poupancaMinima: 10,        // % da renda que vale guardar por mês
  comprometimentoMaximo: 50, // % da renda média comprometida com faturas
  foraDaCurva: 30,           // % acima da média dos 3 meses anteriores
  reservaMinimaMeses: 3,     // meses de despesas cobertos pela reserva
};

const AVISO = 'As informações desta página são educativas e não constituem recomendação financeira profissional.';
const reais = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const extenso = (anoMes) => {
  const [a, m] = anoMes.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const media = (valores) => (valores.length === 0 ? 0 : arredondar(somarValores(valores) / valores.length));

// Totais por mês: entradas, saídas e saídas fora de cartão (de mesInicial até o fim do mês corrente)
async function serieMensal(usuarioId, mesInicial, mesFinal) {
  const { rows } = await pool.query(
    `SELECT to_char(l.data, 'YYYY-MM') AS mes, l.tipo,
            (f.tipo = 'cartao_credito') AS cartao, SUM(l.valor) AS total
       FROM lancamentos l JOIN fontes_destinos f ON f.id = l.fonte_destino_id
      WHERE l.usuario_id = $1 AND to_char(l.data, 'YYYY-MM') BETWEEN $2 AND $3
      GROUP BY 1, 2, 3`, [usuarioId, mesInicial, mesFinal]);
  const mapa = {};
  for (const r of rows) {
    const m = (mapa[r.mes] ??= { entradas: 0, saidas: 0, saidasSemCartao: 0 });
    if (r.tipo === 'entrada') m.entradas = arredondar(m.entradas + r.total);
    else {
      m.saidas = arredondar(m.saidas + r.total);
      if (!r.cartao) m.saidasSemCartao = arredondar(m.saidasSemCartao + r.total);
    }
  }
  return mapa;
}

async function totalPorCategoriaEMes(usuarioId, mesInicial, mesFinal) {
  const { rows } = await pool.query(
    `SELECT c.nome, to_char(l.data, 'YYYY-MM') AS mes, SUM(l.valor) AS total
       FROM lancamentos l JOIN categorias c ON c.id = l.categoria_id
      WHERE l.usuario_id = $1 AND l.tipo = 'saida' AND to_char(l.data, 'YYYY-MM') BETWEEN $2 AND $3
      GROUP BY 1, 2`, [usuarioId, mesInicial, mesFinal]);
  return rows;
}

async function saldoAcumulado(usuarioId, ate, soReserva = false) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor ELSE -l.valor END)
                     FILTER (WHERE NOT (l.tipo = 'saida' AND f.tipo = 'cartao_credito')), 0) AS saldo
       FROM lancamentos l JOIN fontes_destinos f ON f.id = l.fonte_destino_id
      WHERE l.usuario_id = $1 AND l.data <= $2 AND ($3::boolean IS FALSE OR f.reserva = true)`,
    [usuarioId, ate, soReserva]);
  return rows[0].saldo;
}

export async function calcular(usuarioId, hoje = hojeISO()) {
  const atual = hoje.slice(0, 7);
  const anteriores = [-3, -2, -1].map((n) => somarMeses(atual, n));
  const serie = await serieMensal(usuarioId, anteriores[0], atual);
  const get = (m) => serie[m] ?? { entradas: 0, saidas: 0, saidasSemCartao: 0 };
  const cartoes = await Fatura.resumo(usuarioId, hoje);

  // Taxa de poupança por mês
  const historico = [...anteriores, atual].map((mes) => {
    const { entradas, saidas } = get(mes);
    return { mes, entradas, saidas, taxa: entradas > 0 ? arredondar(((entradas - saidas) / entradas) * 100) : null };
  });
  const taxaPoupanca = { atual: historico[3].taxa, mesAnterior: historico[2].taxa, historico };

  const rendaMedia = media(anteriores.map((m) => get(m).entradas));
  const saidasMedia = media(anteriores.map((m) => get(m).saidas));
  const saidasSemCartaoMedia = media(anteriores.map((m) => get(m).saidasSemCartao));

  // Comprometimento: faturas que vencem no mês corrente e nos 2 seguintes ÷ renda dos 3 meses
  const proximos3 = [0, 1, 2].map((n) => somarMeses(atual, n));
  const totalProximas = somarValores(proximos3.map((m) => cartoes.aVencer[m] ?? 0));
  const comprometimentoCartoes = {
    totalProximas3Meses: totalProximas,
    rendaMediaMensal: rendaMedia,
    percentual: rendaMedia > 0 ? arredondar((totalProximas / (rendaMedia * 3)) * 100) : null,
  };

  // Parcelas futuras
  const porMes = Object.entries(cartoes.parcelas).sort(([x], [y]) => x.localeCompare(y)).map(([mes, total]) => ({ mes, total }));
  const parcelasFuturas = { total: somarValores(porMes.map((p) => p.total)), porMes };

  // Reserva de emergência
  const saldoReserva = await saldoAcumulado(usuarioId, hoje, true);
  const temReserva = (await pool.query(
    'SELECT 1 FROM fontes_destinos WHERE usuario_id = $1 AND reserva = true LIMIT 1', [usuarioId])).rowCount > 0;
  const reservaEmergencia = {
    temReserva,
    saldoReserva: arredondar(saldoReserva),
    mesesCobertos: temReserva && saidasMedia > 0 ? arredondar(saldoReserva / saidasMedia) : null,
  };

  // Categorias fora da curva (mês corrente × média dos 3 anteriores)
  const porCategoria = await totalPorCategoriaEMes(usuarioId, anteriores[0], atual);
  const categoriasForaDaCurva = [];
  for (const nome of new Set(porCategoria.map((r) => r.nome))) {
    const doNome = (m) => porCategoria.find((r) => r.nome === nome && r.mes === m)?.total ?? 0;
    const mediaCat = media(anteriores.map(doNome));
    const atualCat = doNome(atual);
    if (mediaCat > 0 && atualCat > mediaCat * (1 + LIMITES.foraDaCurva / 100)) {
      categoriasForaDaCurva.push({
        categoria: nome, atual: atualCat, media: mediaCat,
        percentualAcima: arredondar(((atualCat - mediaCat) / mediaCat) * 100),
      });
    }
  }

  // Projeção de 6 meses: média das entradas − saídas fora do cartão − faturas já conhecidas
  // Saldo inicial já desconta as faturas vencidas e as que vencem no mês corrente; a projeção cobre atual+1 em diante.
  const saldoAtual = arredondar((await saldoAcumulado(usuarioId, hoje)) - cartoes.vencido - (cartoes.aVencer[atual] ?? 0));
  let saldo = saldoAtual;
  const projecao = [1, 2, 3, 4, 5, 6].map((n) => {
    const mes = somarMeses(atual, n);
    const saidas = arredondar(saidasSemCartaoMedia + (cartoes.aVencer[mes] ?? 0));
    saldo = arredondar(saldo + rendaMedia - saidas);
    return { mes, entradas: rendaMedia, saidas, saldo };
  });

  const indicadores = { taxaPoupanca, comprometimentoCartoes, parcelasFuturas, reservaEmergencia, categoriasForaDaCurva };
  return { referencia: hoje, aviso: AVISO, saldoAtual, limites: LIMITES, indicadores, projecao, dicas: gerarDicas(indicadores, projecao) };
}

function gerarDicas(ind, projecao) {
  const dicas = [];
  const { mesAnterior, historico } = ind.taxaPoupanca;
  const nomeMes = extenso(historico[2].mes);

  if (mesAnterior === null) {
    dicas.push({ tipo: 'info', texto: 'Ainda não há renda registrada nos meses recentes. Cadastre suas entradas e saídas para ver análises mais completas.' });
  } else if (mesAnterior < LIMITES.poupancaMinima) {
    dicas.push({ tipo: 'alerta', texto: `Você guardou ${mesAnterior}% da sua renda em ${nomeMes}. Uma meta comum é guardar pelo menos ${LIMITES.poupancaMinima}%.` });
  } else {
    dicas.push({ tipo: 'ok', texto: `Você guardou ${mesAnterior}% da sua renda em ${nomeMes}. Continue assim!` });
  }

  const { percentual, totalProximas3Meses } = ind.comprometimentoCartoes;
  if (percentual !== null && totalProximas3Meses > 0) {
    dicas.push({
      tipo: percentual > LIMITES.comprometimentoMaximo ? 'alerta' : 'info',
      texto: `Suas faturas dos próximos 3 meses (${reais(totalProximas3Meses)}) comprometem ${percentual}% da sua renda média.`,
    });
  }
  if (ind.parcelasFuturas.total > 0) {
    const ultimo = ind.parcelasFuturas.porMes.at(-1).mes;
    dicas.push({ tipo: 'info', texto: `Você tem ${reais(ind.parcelasFuturas.total)} em parcelas a vencer até ${extenso(ultimo)}.` });
  }
  for (const c of ind.categoriasForaDaCurva) {
    dicas.push({ tipo: 'alerta', texto: `Seus gastos com ${c.categoria} estão ${c.percentualAcima}% acima da sua média dos últimos 3 meses.` });
  }
  const r = ind.reservaEmergencia;
  if (!r.temReserva) {
    dicas.push({ tipo: 'info', texto: 'Marque uma conta como "reserva de emergência" em Fontes/Destinos para acompanhar quantos meses de despesas ela cobre.' });
  } else if (r.mesesCobertos !== null) {
    dicas.push({
      tipo: r.mesesCobertos < LIMITES.reservaMinimaMeses ? 'alerta' : 'ok',
      texto: `Sua reserva cobre ${r.mesesCobertos.toLocaleString('pt-BR')} mês(es) de despesas. Uma referência comum é de 3 a 6 meses.`,
    });
  }
  const negativo = projecao.find((p) => p.saldo < 0);
  if (negativo) {
    dicas.push({ tipo: 'alerta', texto: `Pela projeção, seu saldo pode ficar negativo em ${extenso(negativo.mes)}. Revise seus gastos.` });
  }
  return dicas;
}
