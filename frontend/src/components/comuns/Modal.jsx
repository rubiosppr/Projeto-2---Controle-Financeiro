export default function Modal({ titulo, aoFechar, children }) {
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-topo">
          <h2>{titulo}</h2>
          <button type="button" className="link" onClick={aoFechar} aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
