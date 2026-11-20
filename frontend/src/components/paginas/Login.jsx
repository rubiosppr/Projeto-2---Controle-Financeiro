import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import CampoForm from '../comuns/CampoForm.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setMensagem('');
    const novos = {};
    if (!form.email.trim()) novos.email = 'Informe o e-mail.';
    if (!form.senha) novos.senha = 'Informe a senha.';
    setErros(novos);
    if (Object.keys(novos).length) return;

    setEnviando(true);
    try {
      await login(form.email, form.senha);
      navigate('/');
    } catch (erro) {
      setErros(erro.campos ?? {});
      setMensagem(erro.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth">
      <form className="cartao" onSubmit={enviar} noValidate>
        <h1>Entrar</h1>
        {mensagem && <p className="erro-bloco" role="alert">{mensagem}</p>}
        <CampoForm id="email" rotulo="E-mail" erro={erros.email}>
          <input id="email" type="email" autoComplete="username" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </CampoForm>
        <CampoForm id="senha" rotulo="Senha" erro={erros.senha}>
          <input id="senha" type="password" autoComplete="current-password" value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })} />
        </CampoForm>
        <button type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <p>Não tem conta? <Link to="/cadastro">Cadastre-se</Link></p>
      </form>
    </div>
  );
}
