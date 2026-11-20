import { Router } from 'express';
import { ErroApi, naoEncontrado, traduzirDuplicata } from '../middlewares/erros.js';
import { validarId } from '../middlewares/validar.js';
import { validarFonteDestino } from '../middlewares/validarCadastros.js';
import * as FonteDestino from '../models/fonteDestino.js';

const router = Router();
router.param('id', validarId);

const DUPLICADA = 'Já existe uma fonte/destino com este nome.';

router.get('/', async (req, res) => res.json(await FonteDestino.listar(req.usuarioId)));

router.post('/', validarFonteDestino, async (req, res) => {
  try {
    res.status(201).json(await FonteDestino.criar(req.usuarioId, req.dados));
  } catch (erro) {
    throw traduzirDuplicata(erro, DUPLICADA);
  }
});

router.put('/:id', validarFonteDestino, async (req, res) => {
  const id = Number(req.params.id);
  const atual = await FonteDestino.buscar(req.usuarioId, id);
  if (!atual) throw naoEncontrado('Fonte/destino não encontrada.');
  if (req.dados.tipo !== atual.tipo && (await FonteDestino.contarLancamentos(req.usuarioId, id)) > 0) {
    throw new ErroApi(409, 'Não é possível alterar o tipo de uma fonte/destino que possui lançamentos.',
      { tipo: 'A fonte/destino possui lançamentos.' });
  }
  try {
    res.json(await FonteDestino.atualizar(req.usuarioId, id, req.dados));
  } catch (erro) {
    throw traduzirDuplicata(erro, DUPLICADA);
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!(await FonteDestino.buscar(req.usuarioId, id))) throw naoEncontrado('Fonte/destino não encontrada.');
  if ((await FonteDestino.contarLancamentos(req.usuarioId, id)) > 0) {
    throw new ErroApi(409, 'Não é possível excluir uma fonte/destino que possui lançamentos. Mova ou exclua os lançamentos antes.');
  }
  await FonteDestino.excluir(req.usuarioId, id);
  res.status(204).end();
});

export default router;
