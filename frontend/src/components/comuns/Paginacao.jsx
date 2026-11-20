export default function Paginacao({ pagina, paginas, aoMudar }) {
  if (paginas <= 1) return null;
  return (
    <div className="barra" style={{ justifyContent: 'center', marginTop: '1rem' }}>
      <button type="button" className="secundario" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>Anterior</button>
      <span>Página {pagina} de {paginas}</span>
      <button type="button" className="secundario" disabled={pagina >= paginas} onClick={() => aoMudar(pagina + 1)}>Próxima</button>
    </div>
  );
}
