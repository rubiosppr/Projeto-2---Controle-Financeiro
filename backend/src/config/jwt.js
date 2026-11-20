import jwt from 'jsonwebtoken';
import { env } from './env.js';

export const assinar = (usuarioId) =>
  jwt.sign({}, env.jwtSecret, { subject: String(usuarioId), expiresIn: env.jwtExpira });

export const verificar = (token) => jwt.verify(token, env.jwtSecret);
