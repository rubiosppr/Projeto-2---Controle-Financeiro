import { Router } from 'express';
import * as SaudeFinanceira from '../models/saudeFinanceira.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await SaudeFinanceira.calcular(req.usuarioId));
});

export default router;
