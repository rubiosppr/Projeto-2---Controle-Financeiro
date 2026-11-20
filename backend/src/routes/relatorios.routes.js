import { Router } from 'express';
import { ErroApi } from '../middlewares/erros.js';
import { inteiroPositivo, validarPeriodo } from '../middlewares/validar.js';
import * as Relatorio from '../models/relatorio.js';
import * as Fatura from '../models/fatura.js';

const router = Router();

router.get('/categorias', validarPeriodo, async (req, res) => {
  res.json(await Relatorio.categorias(req.usuarioId, req.periodo));
});

router.get('/fontes-destinos', validarPeriodo, async (req, res) => {
  res.json(await Relatorio.fontesDestinos(req.usuarioId, req.periodo));
});

router.get('/faturas', async (req, res) => {
  let meses = 3;
  if (req.query.meses !== undefined) {
    meses = typeof req.query.meses === 'string' ? inteiroPositivo(req.query.meses) : null;
    if (meses === null || meses > 12) {
      throw new ErroApi(400, 'Parâmetro inválido.', { meses: 'Informe um número de meses de 1 a 12.' });
    }
  }
  res.json(await Fatura.previsao(req.usuarioId, meses));
});

export default router;
