import Modal from './Modal.jsx';

// children = botões de ação; o botão "Cancelar" é padrão
export default function ModalConfirmar({ titulo, mensagem, aoFechar, children }) {
  return (
    <Modal titulo={titulo} aoFechar={aoFechar}>
      <p>{mensagem}</p>
      <div className="acoes">
        {children}
        <button type="button" className="secundario" onClick={aoFechar}>Cancelar</button>
      </div>
    </Modal>
  );
}
