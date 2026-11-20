import { criarValidador, texto } from './validar.js';
import { cpfValido } from '../models/cpf.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validarCadastro = criarValidador((b, campos) => {
  const nome = texto(b.nome);
  const email = texto(b.email).toLowerCase();
  const cpf = String(b.cpf ?? '').replace(/\D/g, '');
  const senha = typeof b.senha === 'string' ? b.senha : '';

  if (!nome) campos.nome = 'Informe o nome.';
  else if (nome.length > 120) campos.nome = 'O nome deve ter no máximo 120 caracteres.';

  if (!email) campos.email = 'Informe o e-mail.';
  else if (!EMAIL.test(email) || email.length > 160) campos.email = 'E-mail inválido.';

  if (!cpf) campos.cpf = 'Informe o CPF.';
  else if (!cpfValido(cpf)) campos.cpf = 'CPF inválido.';

  if (!senha) campos.senha = 'Informe a senha.';
  else if (senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    campos.senha = 'A senha deve ter no mínimo 8 caracteres, com letras e números.';
  } else if (senha.length > 72) campos.senha = 'A senha deve ter no máximo 72 caracteres.';

  if (b.confirmarSenha !== undefined && b.confirmarSenha !== senha) {
    campos.confirmarSenha = 'As senhas não conferem.';
  }
  return { nome, email, cpf, senha };
});

export const validarLogin = criarValidador((b, campos) => {
  const email = texto(b.email).toLowerCase();
  const senha = typeof b.senha === 'string' ? b.senha : '';
  if (!email) campos.email = 'Informe o e-mail.';
  if (!senha) campos.senha = 'Informe a senha.';
  return { email, senha };
});
