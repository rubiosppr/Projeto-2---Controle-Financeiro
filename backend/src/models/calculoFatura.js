// Datas em UTC para evitar problemas de fuso horário.
function ultimoDiaDoMes(ano, mes) { // mes: 0 a 11
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
}

function dataSegura(ano, mes, dia) { // aceita mes > 11 e ajusta dia 31 em meses curtos
  const a = ano + Math.floor(mes / 12);
  const m = ((mes % 12) + 12) % 12;
  return new Date(Date.UTC(a, m, Math.min(dia, ultimoDiaDoMes(a, m))));
}

const iso = (d) => d.toISOString().slice(0, 10);

// Mês (índice, podendo passar de 11) em que fecha a fatura da parcela informada
function mesDeFechamento(dataCompra, cartao, numeroParcela) {
  const [ano, mes, dia] = dataCompra.split('-').map(Number);
  const m = mes - 1;
  const fechamentoDoMes = Math.min(cartao.diaFechamento, ultimoDiaDoMes(ano, m));
  const base = dia < fechamentoDoMes ? m : m + 1; // no dia do fechamento ou depois: mês seguinte
  return { ano, mes: base + numeroParcela - 1 };
}

function montarFatura(ano, mesFechamento, cartao) {
  const fechamento = dataSegura(ano, mesFechamento, cartao.diaFechamento);
  const mesVencimento = cartao.diaVencimento > cartao.diaFechamento ? mesFechamento : mesFechamento + 1;
  const vencimento = dataSegura(ano, mesVencimento, cartao.diaVencimento);
  return { referencia: iso(vencimento).slice(0, 7), fechamento: iso(fechamento), vencimento: iso(vencimento) };
}

// dataCompra: 'AAAA-MM-DD'; cartao: { diaFechamento, diaVencimento }
export function calcularFatura(dataCompra, cartao, numeroParcela = 1) {
  const { ano, mes } = mesDeFechamento(dataCompra, cartao, numeroParcela);
  return montarFatura(ano, mes, cartao);
}

// Fatura imediatamente anterior à aberta na data informada (fechada, possivelmente ainda não paga)
export function faturaAnterior(dataBase, cartao) {
  const { ano, mes } = mesDeFechamento(dataBase, cartao, 1);
  return montarFatura(ano, mes - 1, cartao);
}

// Faturas consecutivas a partir da fatura aberta na data informada
export function listarFaturas(dataBase, cartao, quantidade) {
  const { ano, mes } = mesDeFechamento(dataBase, cartao, 1);
  return Array.from({ length: quantidade }, (_, k) => montarFatura(ano, mes + k, cartao));
}
