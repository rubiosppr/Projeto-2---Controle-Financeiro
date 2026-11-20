import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.teste,
  handler: (req, res) => res.status(429).json({ erro: 'Muitas tentativas de login. Tente novamente em alguns minutos.' }),
});
