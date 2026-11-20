import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { cpfValido } from '../../utils/cpf.js';
import { mascararCpf } from '../../utils/mascaras.js';
import CampoForm from '../comuns/CampoForm.jsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validar(f) {
  const e = {};
  if (!f.nome.trim()) e.nome = 'Informe o nome.';
  if (!EMAIL.test(f.email.trim())) e.email = 'E-mail inválido.';
  if (!cpfValido(f.cpf)) e.cpf = 'CPF inválido.';
  if (f.senha.length < 8 || !/[A-Za-z]/.test(f.senha) || !/\d/.test(f.senha)) {
    e.senha = 'A senha deve ter no mínimo 8 caracteres, com letras e números.';
  }
  if (f.confirmarSenha !== f.senha) e.confirmarSenha = 'As senhas não conferem.';
  return e;
}

export default function Cadastro() {
  const { cadastrar } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: '', email: '', cpf: '', senha: '', confirmarSenha: '' });
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  const mudar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setMensagem('');
    const novos = validar(form);
    setErros(novos);
    if (Object.keys(novos).length) return;

    setEnviando(true);
    try {
      await cadastrar({ ...form, nome: form.nome.trim(), email: form.email.trim() });
      navigate('/');
    } catch (erro) {
      setErros(erro.campos ?? {}); // ex.: 409 -> mensagem junto ao campo cpf/email
      setMensagem(erro.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth">
      <form className="cartao" onSubmit={enviar} noValidate>
        <h1>Criar conta</h1>
        {mensagem && <p className="erro-bloco" role="alert">{mensagem}</p>}
        <CampoForm id="nome" rotulo="Nome" erro={erros.nome}>
          <input id="nome" value={form.nome} onChange={mudar('nome')} />
        </CampoForm>
        <CampoForm id="email" rotulo="E-mail" erro={erros.email}>
          <input id="email" type="email" value={form.email} onChange={mudar('email')} />
        </CampoForm>
        <CampoForm id="cpf" rotulo="CPF" erro={erros.cpf}>
          <input id="cpf" inputMode="numeric" value={form.cpf}
            onChange={(e) => setForm({ ...form, cpf: mascararCpf(e.target.value) })} />
        </CampoForm>
        <CampoForm id="senha" rotulo="Senha" erro={erros.senha}>
          <input id="senha" type="password" autoComplete="new-password" value={form.senha} onChange={mudar('senha')} />
        </CampoForm>
        <CampoForm id="confirmarSenha" rotulo="Confirmar senha" erro={erros.confirmarSenha}>
          <input id="confirmarSenha" type="password" autoComplete="new-password" value={form.confirmarSenha}
            onChange={mudar('confirmarSenha')} />
        </CampoForm>
        <button type="submit" disabled={enviando}>{enviando ? 'Cadastrando…' : 'Cadastrar'}</button>
        <p>Já tem conta? <Link to="/login">Entrar</Link></p>
      </form>
    </div>
  );
}
