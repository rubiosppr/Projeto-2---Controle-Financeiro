import { Router } from 'express';
import bcrypt from 'bcrypt';
import { transacao } from '../config/db.js';
import { assinar } from '../config/jwt.js';
import { autenticar } from '../middlewares/autenticar.js';
import { limitadorLogin } from '../middlewares/limitadorLogin.js';
import { validarCadastro, validarLogin } from '../middlewares/validarAuth.js';
import * as Usuario from '../models/usuario.js';
import * as Categoria from '../models/categoria.js';
import * as FonteDestino from '../models/fonteDestino.js';

const router = Router();

// Hash descartável: login com e-mail inexistente gasta o mesmo tempo de um login real.
const HASH_FALSO = bcrypt.hashSync('senha-descartavel-1', 10);

router.post('/cadastro', validarCadastro, async (req, res) => {
  const { nome, email, cpf, senha } = req.dados;
  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await transacao(async (client) => {
      const novo = await Usuario.criar({ nome, email, cpf, senhaHash }, client);
      await Categoria.criarPadrao(novo.id, client);
      await FonteDestino.criarPadrao(novo.id, client);
      return novo;
    });
    return res.status(201).json(usuario);
  } catch (erro) {
    if (erro.code === '23505') { // unique_violation: a garantia é do banco
      const campo = erro.constraint?.includes('cpf') ? 'cpf' : 'email';
      return res.status(409).json({
        erro: 'Usuário já cadastrado.',
        campos: { [campo]: `Já existe um usuário com este ${campo === 'cpf' ? 'CPF' : 'e-mail'}.` },
      });
    }
    throw erro;
  }
});

router.post('/login', limitadorLogin, validarLogin, async (req, res) => {
  const { email, senha } = req.dados;
  const usuario = await Usuario.buscarPorEmail(email);
  const confere = await bcrypt.compare(senha, usuario?.senha_hash ?? HASH_FALSO);
  if (!usuario || !confere) return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
  return res.json({
    token: assinar(usuario.id),
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
  });
});

router.get('/me', autenticar, async (req, res) => {
  const usuario = await Usuario.buscarPorId(req.usuarioId);
  if (!usuario) return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  return res.json(usuario);
});

export default router;
