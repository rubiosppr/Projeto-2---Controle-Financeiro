export class ErroApi extends Error {
  constructor(status, mensagem, campos) {
    super(mensagem);
    this.status = status;
    this.campos = campos;
  }
}

export const naoEncontrado = (mensagem = 'Recurso não encontrado.') => new ErroApi(404, mensagem);

// Converte violação de UNIQUE (23505) em 409 amigável; outros erros passam adiante.
export function traduzirDuplicata(erro, mensagem) {
  return erro.code === '23505' ? new ErroApi(409, mensagem, { nome: mensagem }) : erro;
}

export function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: 'Rota não encontrada.' });
}

// eslint-disable-next-line no-unused-vars
export function tratarErros(erro, req, res, next) {
  if (erro instanceof ErroApi) {
    return res.status(erro.status).json({ erro: erro.message, ...(erro.campos && { campos: erro.campos }) });
  }
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido.' });
  }
  if (erro.code === '23505') return res.status(409).json({ erro: 'Registro duplicado.' });
  if (erro.code === '23503') return res.status(409).json({ erro: 'Registro em uso por outros dados.' });
  if (erro.status && erro.status < 500) return res.status(erro.status).json({ erro: 'Requisição inválida.' });
  console.error(erro);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}
