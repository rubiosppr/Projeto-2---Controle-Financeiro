import { criarValidador, texto, inteiroPositivo, valorMonetario } from './validar.js';

const dia = (v) => {
  const n = inteiroPositivo(v);
  return n !== null && n <= 31 ? n : null;
};

export const validarCategoria = criarValidador((b, campos) => {
  const nome = texto(b.nome);
  const tipo = b.tipo;
  if (!nome) campos.nome = 'Informe o nome.';
  else if (nome.length > 60) campos.nome = 'O nome deve ter no máximo 60 caracteres.';
  if (!['entrada', 'saida'].includes(tipo)) campos.tipo = 'Tipo inválido. Use entrada ou saida.';
  return { nome, tipo };
});

export const validarFonteDestino = criarValidador((b, campos) => {
  const nome = texto(b.nome);
  const tipo = b.tipo;
  if (!nome) campos.nome = 'Informe o nome.';
  else if (nome.length > 60) campos.nome = 'O nome deve ter no máximo 60 caracteres.';
  if (!['renda', 'conta', 'cartao_credito'].includes(tipo)) {
    campos.tipo = 'Tipo inválido. Use renda, conta ou cartao_credito.';
  }
  const dados = { nome, tipo, diaFechamento: null, diaVencimento: null, limite: null, reserva: b.reserva === true };
  if (tipo === 'cartao_credito') {
    dados.diaFechamento = dia(b.diaFechamento);
    dados.diaVencimento = dia(b.diaVencimento);
    dados.limite = valorMonetario(b.limite);
    if (dados.diaFechamento === null) campos.diaFechamento = 'Informe o dia de fechamento (1 a 31).';
    if (dados.diaVencimento === null) campos.diaVencimento = 'Informe o dia de vencimento (1 a 31).';
    if (dados.limite === null) campos.limite = 'Informe o limite do cartão (maior que zero).';
  }
  return dados;
});
