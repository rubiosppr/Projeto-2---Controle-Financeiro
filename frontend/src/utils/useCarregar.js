import { useCallback, useEffect, useRef, useState } from 'react';

// Executa fn() ao montar e quando deps mudam. Ignora respostas antigas.
export function useCarregar(fn, deps = []) {
  const [estado, setEstado] = useState({ dados: null, carregando: true, erro: null });
  const contador = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const executar = useCallback(async () => {
    const minha = ++contador.current;
    setEstado((s) => ({ ...s, carregando: true, erro: null }));
    try {
      const dados = await fn();
      if (minha === contador.current) setEstado({ dados, carregando: false, erro: null });
    } catch (e) {
      if (e.status === 401) return; // o AuthContext já voltou ao login
      if (minha === contador.current) setEstado({ dados: null, carregando: false, erro: e.message });
    }
  }, deps);

  useEffect(() => { executar(); }, [executar]);

  return { ...estado, recarregar: executar };
}
