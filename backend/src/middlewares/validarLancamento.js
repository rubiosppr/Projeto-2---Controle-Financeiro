import { ErroApi } from './erros.js';
import { criarValidador, texto, inteiroPositivo, valorMonetario } from './validar.js';
import { dataValida } from '../models/datas.js';

export const validarLancamento = criarValidador((b, campos) => {
  const tipo = b.tipo;
  const descricao = texto(b.descricao);
  const valor = valorMonetario(b.valor);
  const data = b.data;
  const categoriaId = inteiroPositivo(b.categoriaId);
  const fonteDestinoId = inteiroPositivo(b.fonteDestinoId);
  let totalParcelas = 1;

  if (!['entrada', 'saida'].includes(tipo)) campos.tipo = 'Informe o tipo: entrada ou saida.';
  if (!descricao) campos.descricao = 'Informe a descrição.';
  else if (descricao.length > 120) campos.descricao = 'A descrição deve ter no máximo 120 caracteres.';
  if (valor === null) campos.valor = 'O valor deve ser maior que zero, com até 2 casas decimais.';
  if (!dataValida(data)) campos.data = 'Informe uma data válida (AAAA-MM-DD).';
  if (categoriaId === null) campos.categoriaId = 'Informe a categoria.';
  if (fonteDestinoId === null) campos.fonteDestinoId = 'Informe a fonte/destino.';
  if (b.totalParcelas !== undefined && b.totalParcelas !== null) {
    const n = inteiroPositivo(b.totalParcelas);
    if (n === null || n > 48) campos.totalParcelas = 'O número de parcelas deve ser de 1 a 48.';
    else totalParcelas = n;
  }
  return { tipo, descricao, valor, data, categoriaId, fonteDestinoId, totalParcelas };
});

// Filtros da listagem (o período vem de validarPeriodo, que roda antes)
export function validarFiltrosLancamento(req, res, next) {
  const q = req.query;
  const campos = {};
  const um = (v) => (typeof v === 'string' ? v : undefined);

  let tipo = null;
  if (q.tipo !== undefined) {
    if (['entrada', 'saida'].includes(um(q.tipo))) tipo = q.tipo;
    else campos.tipo = 'Tipo inválido. Use entrada ou saida.';
  }
  const idOpcional = (nome) => {
    if (q[nome] === undefined || q[nome] === '') return null;
    const n = inteiroPositivo(um(q[nome]));
    if (n === null) campos[nome] = 'Informe um número válido.';
    return n;
  };
  const categoriaId = idOpcional('categoriaId');
  const fonteDestinoId = idOpcional('fonteDestinoId');

  let pagina = 1;
  if (q.pagina !== undefined) {
    pagina = inteiroPositivo(um(q.pagina));
    if (pagina === null) { campos.pagina = 'A página deve ser um inteiro a partir de 1.'; pagina = 1; }
  }
  let limite = 20;
  if (q.limite !== undefined) {
    limite = inteiroPositivo(um(q.limite));
    if (limite === null || limite > 100) { campos.limite = 'O limite deve ser de 1 a 100.'; limite = 20; }
  }

  if (Object.keys(campos).length > 0) return next(new ErroApi(400, 'Filtros inválidos.', campos));
  req.filtros = { tipo, categoriaId, fonteDestinoId, pagina, limite };
  return next();
}
