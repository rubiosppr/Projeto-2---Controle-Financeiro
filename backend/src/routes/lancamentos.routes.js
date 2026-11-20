import { Router } from 'express';
import { ErroApi, naoEncontrado } from '../middlewares/erros.js';
import { validarId, validarPeriodo } from '../middlewares/validar.js';
import { validarFiltrosLancamento, validarLancamento } from '../middlewares/validarLancamento.js';
import * as Lancamento from '../models/lancamento.js';
import * as Categoria from '../models/categoria.js';
import * as FonteDestino from '../models/fonteDestino.js';

const router = Router();
router.param('id', validarId);

// Regras que dependem do banco: posse, tipo da categoria e parcelamento.
async function verificarReferencias(usuarioId, d) {
  const categoria = await Categoria.buscar(usuarioId, d.categoriaId);
  if (!categoria) {
    throw new ErroApi(404, 'Categoria não encontrada.', { categoriaId: 'A categoria informada não existe.' });
  }
  const fonte = await FonteDestino.buscar(usuarioId, d.fonteDestinoId);
  if (!fonte) {
    throw new ErroApi(404, 'Fonte/destino não encontrada.', { fonteDestinoId: 'A fonte/destino informada não existe.' });
  }
  if (categoria.tipo !== d.tipo) {
    throw new ErroApi(400, 'Dados inválidos.', {
      categoriaId: `A categoria informada é de ${categoria.tipo}, mas o lançamento é de ${d.tipo}.`,
    });
  }
  if (d.totalParcelas > 1 && !(d.tipo === 'saida' && fonte.tipo === 'cartao_credito')) {
    throw new ErroApi(400, 'Dados inválidos.', {
      totalParcelas: 'Somente compras (saídas) no cartão de crédito podem ser parceladas.',
    });
  }
  return fonte;
}

router.get('/', validarPeriodo, validarFiltrosLancamento, async (req, res) => {
  res.json(await Lancamento.listar(req.usuarioId, { ...req.periodo, ...req.filtros }));
});

router.post('/', validarLancamento, async (req, res) => {
  await verificarReferencias(req.usuarioId, req.dados);
  const lancamentos = await Lancamento.criar(req.usuarioId, req.dados);
  res.status(201).json({ lancamentos });
});

router.get('/:id', async (req, res) => {
  const l = await Lancamento.buscar(req.usuarioId, Number(req.params.id));
  if (!l) throw naoEncontrado('Lançamento não encontrado.');
  res.json(l);
});

// A edição altera somente a linha informada (cada parcela é um lançamento).
router.put('/:id', validarLancamento, async (req, res) => {
  const id = Number(req.params.id);
  const atual = await Lancamento.buscar(req.usuarioId, id);
  if (!atual) throw naoEncontrado('Lançamento não encontrado.');
  const dados = { ...req.dados, totalParcelas: 1 };
  await verificarReferencias(req.usuarioId, dados);
  if (atual.totalParcelas > 1 && (dados.tipo !== atual.tipo || dados.fonteDestinoId !== atual.fonteDestinoId)) {
    throw new ErroApi(400, 'Dados inválidos.', {
      fonteDestinoId: 'Parcelas de uma compra parcelada não podem mudar de tipo nem de cartão.',
    });
  }
  res.json(await Lancamento.atualizar(req.usuarioId, id, dados));
});

router.delete('/:id', async (req, res) => {
  const achou = await Lancamento.excluir(req.usuarioId, Number(req.params.id), req.query.todasParcelas === 'true');
  if (!achou) throw naoEncontrado('Lançamento não encontrado.');
  res.status(204).end();
});

export default router;
