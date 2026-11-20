import { Router } from 'express';
import { ErroApi, naoEncontrado, traduzirDuplicata } from '../middlewares/erros.js';
import { validarId } from '../middlewares/validar.js';
import { validarCategoria } from '../middlewares/validarCadastros.js';
import * as Categoria from '../models/categoria.js';

const router = Router();
router.param('id', validarId);

const DUPLICADA = 'Já existe uma categoria com este nome para este tipo.';

router.get('/', async (req, res) => res.json(await Categoria.listar(req.usuarioId)));

router.post('/', validarCategoria, async (req, res) => {
  try {
    res.status(201).json(await Categoria.criar(req.usuarioId, req.dados));
  } catch (erro) {
    throw traduzirDuplicata(erro, DUPLICADA);
  }
});

router.put('/:id', validarCategoria, async (req, res) => {
  const id = Number(req.params.id);
  const atual = await Categoria.buscar(req.usuarioId, id);
  if (!atual) throw naoEncontrado('Categoria não encontrada.');
  if (atual.tipo !== req.dados.tipo && (await Categoria.contarLancamentos(req.usuarioId, id)) > 0) {
    throw new ErroApi(409, 'Não é possível alterar o tipo de uma categoria que possui lançamentos.', {
      tipo: 'A categoria possui lançamentos.',
    });
  }
  try {
    res.json(await Categoria.atualizar(req.usuarioId, id, req.dados));
  } catch (erro) {
    throw traduzirDuplicata(erro, DUPLICADA);
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!(await Categoria.buscar(req.usuarioId, id))) throw naoEncontrado('Categoria não encontrada.');
  if ((await Categoria.contarLancamentos(req.usuarioId, id)) > 0) {
    throw new ErroApi(409, 'Não é possível excluir uma categoria que possui lançamentos. Mova ou exclua os lançamentos antes.');
  }
  await Categoria.excluir(req.usuarioId, id);
  res.status(204).end();
});

export default router;
