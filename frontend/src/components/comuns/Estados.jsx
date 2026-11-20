export function Carregando() {
  return <p className="estado" role="status">Carregando…</p>;
}

export function Vazio({ children }) {
  return <p className="estado">{children}</p>;
}

export function MensagemErro({ mensagem, aoTentar }) {
  return (
    <div className="estado erro-bloco" role="alert">
      <p>{mensagem}</p>
      {aoTentar && <button type="button" onClick={aoTentar}>Tentar novamente</button>}
    </div>
  );
}

// Trata carregando, erro e lista vazia de uma vez
export function Estado({ carregando, erro, vazio, textoVazio = 'Nada por aqui ainda.', recarregar, children }) {
  if (carregando) return <Carregando />;
  if (erro) return <MensagemErro mensagem={erro} aoTentar={recarregar} />;
  if (vazio) return <Vazio>{textoVazio}</Vazio>;
  return children;
}
