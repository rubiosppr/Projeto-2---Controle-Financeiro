import { ErroApi, naoEncontrado } from './erros.js';
import { dataValida, mesCorrente } from '../models/datas.js';

export function criarValidador(fn) {
  return (req, res, next) => {
    const campos = {};
    const dados = fn(req.body ?? {}, campos, req);
    if (Object.keys(campos).length > 0) return next(new ErroApi(400, 'Dados inválidos.', campos));
    req.dados = dados;
    return next();
  };
}

export const texto = (v) => (typeof v === 'string' ? v.trim() : '');

export function inteiroPositivo(v) {
  const n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v;
  return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}

// Aceita número ou string "123.45" (ponto); no máximo 2 casas; > 0.
export function valorMonetario(v) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d{1,2})?$/.test(v.trim()) ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 9999999999.99) return null;
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return null;
  return Math.round(n * 100) / 100;
}

// Para router.param('id', validarId): id não numérico -> 404
export function validarId(req, res, next, id) {
  if (!/^\d+$/.test(id) || Number(id) > 2147483647) return next(naoEncontrado());
  return next();
}

// Lê ?inicio=&fim= (padrão: mês corrente) e preenche req.periodo
export function validarPeriodo(req, res, next) {
  const padrao = mesCorrente();
  const inicio = req.query.inicio ?? padrao.inicio;
  const fim = req.query.fim ?? padrao.fim;
  const campos = {};
  if (!dataValida(inicio)) campos.inicio = 'Informe uma data inicial válida (AAAA-MM-DD).';
  if (!dataValida(fim)) campos.fim = 'Informe uma data final válida (AAAA-MM-DD).';
  if (Object.keys(campos).length === 0 && inicio > fim) campos.inicio = 'A data inicial deve ser anterior ou igual à final.';
  if (Object.keys(campos).length > 0) return next(new ErroApi(400, 'Período inválido.', campos));
  req.periodo = { inicio, fim };
  return next();
}
