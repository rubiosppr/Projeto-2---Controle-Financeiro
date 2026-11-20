import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js';
import authRoutes from './routes/auth.routes.js';

export const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.use('/api/auth', authRoutes);

app.use(rotaNaoEncontrada);
app.use(tratarErros);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(env.porta, () => console.log(`API em http://localhost:${env.porta}`));
}
