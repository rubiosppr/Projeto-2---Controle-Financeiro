export default function CampoForm({ id, rotulo, erro, children }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      {children}
      {erro && <span className="erro-campo" role="alert">{erro}</span>}
    </div>
  );
}
