import { useState } from 'react';
import { api } from '../../services/api.js';
import { useCarregar } from '../../utils/useCarregar.js';
import { Estado } from '../comuns/Estados.jsx';
import Modal from '../comuns/Modal.jsx';
import CampoForm from '../comuns/CampoForm.jsx';

const ROTULO = { entrada: 'Entrada', saida: 'Saída' };

export default function Categorias() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/categorias'), []);
  const [editando, setEditando] = useState(null); // null fechado; {} novo; objeto = edição
  const [form, setForm] = useState({ nome: '', tipo: 'saida' });
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');

  function abrir(cat) {
    setEditando(cat);
    setForm(cat.id ? { nome: cat.nome, tipo: cat.tipo } : { nome: '', tipo: 'saida' });
    setErros({});
    setMensagem('');
  }

  async function salvar(e) {
    e.preventDefault();
    try {
      if (editando.id) await api.put(`/categorias/${editando.id}`, form);
      else await api.post('/categorias', form);
      setEditando(null);
      recarregar();
    } catch (err) {
      setErros(err.campos ?? {});
      setMensagem(err.message);
    }
  }

  async function excluir(cat) {
    if (!window.confirm(`Excluir a categoria "${cat.nome}"?`)) return;
    try {
      await api.delete(`/categorias/${cat.id}`);
      recarregar();
    } catch (err) {
      window.alert(err.message); // ex.: 409 com explicação
    }
  }

  return (
    <section>
      <div className="barra">
        <h2>Categorias</h2>
        <button type="button" onClick={() => abrir({})}>Nova categoria</button>
      </div>
      <Estado carregando={carregando} erro={erro} recarregar={recarregar}
        vazio={dados?.length === 0} textoVazio="Nenhuma categoria cadastrada.">
        <table>
          <thead><tr><th>Nome</th><th>Tipo</th><th /></tr></thead>
          <tbody>
            {dados?.map((c) => (
              <tr key={c.id}>
                <td>{c.nome}</td>
                <td className={c.tipo}>{ROTULO[c.tipo]}</td>
                <td className="acoes">
                  <button type="button" className="secundario" onClick={() => abrir(c)}>Editar</button>
                  <button type="button" className="perigo" onClick={() => excluir(c)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Estado>

      {editando && (
        <Modal titulo={editando.id ? 'Editar categoria' : 'Nova categoria'} aoFechar={() => setEditando(null)}>
          <form onSubmit={salvar} noValidate>
            {mensagem && <p className="erro-bloco" role="alert">{mensagem}</p>}
            <CampoForm id="nome" rotulo="Nome" erro={erros.nome}>
              <input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </CampoForm>
            <CampoForm id="tipo" rotulo="Tipo" erro={erros.tipo}>
              <select id="tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="saida">Saída</option>
                <option value="entrada">Entrada</option>
              </select>
            </CampoForm>
            <button type="submit">Salvar</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
