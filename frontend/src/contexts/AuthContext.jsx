import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, definirAoExpirar, lerToken, limparToken, salvarToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(lerToken);
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(lerToken()));

  const logout = useCallback(() => {
    limparToken();
    setToken(null);
    setUsuario(null);
  }, []);

  useEffect(() => {
    definirAoExpirar(logout);
  }, [logout]);

  // Ao recarregar a página, valida o token guardado.
  useEffect(() => {
    if (!lerToken()) return;
    api.get('/auth/me')
      .then(setUsuario)
      .catch((erro) => { if (erro?.status === 401) logout(); })
      .finally(() => setCarregando(false));
  }, [logout]);

  const login = useCallback(async (email, senha) => {
    const dados = await api.post('/auth/login', { email, senha });
    salvarToken(dados.token);
    setToken(dados.token);
    setUsuario(dados.usuario);
  }, []);

  const cadastrar = useCallback(async (dados) => {
    await api.post('/auth/cadastro', dados);
    await login(dados.email, dados.senha);
  }, [login]);

  const valor = useMemo(
    () => ({ usuario, token, carregando, login, logout, cadastrar }),
    [usuario, token, carregando, login, logout, cadastrar],
  );
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
