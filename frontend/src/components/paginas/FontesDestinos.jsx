import { useState } from 'react';
import { api } from '../../services/api.js';
import { useCarregar } from '../../utils/useCarregar.js';
import { moeda } from '../../utils/formatar.js';
import { mascararValor, numeroParaCampo, valorParaNumero } from '../../utils/mascaras.js';
import { Estado } from '../comuns/Estados.jsx';
import Modal from '../comuns/Modal.jsx';
import CampoForm from '../comuns/CampoForm.jsx';

const TIPOS = { renda: 'Renda', conta: 'Conta', cartao_credito: 'Cartão de crédito' };
const VAZIO = { nome: '', tipo: 'conta', diaFechamento: '', diaVencimento: '', limite: '', reserva: false };

export default function FontesDestinos() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/fontes-destinos'), []);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');

  function abrir(f) {
    setEditando(f);
    setForm(f.id ? {
      nome: f.nome, tipo: f.tipo, reserva: f.reserva,
      diaFechamento: f.diaFechamento ?? '', diaVencimento: f.diaVencimento ?? '',
      limite: f.limite != null ? numeroParaCampo(f.limite) : '',
    } : VAZIO);
    setErros({});
    setMensagem('');
  }

  async function salvar(e) {
    e.preventDefault();
    const cartao = form.tipo === 'cartao_credito';
    const corpo = {
      nome: form.nome, tipo: form.tipo, reserva: form.reserva,
      ...(cartao && {
        diaFechamento: Number(form.diaFechamento) || null,
        diaVencimento: Number(form.diaVencimento) || null,
        limite: form.limite ? valorParaNumero(form.limite) : null,
      }),
    };
    try {
      if (editando.id) await api.put(`/fontes-destinos/${editando.id}`, corpo);
      else await api.post('/fontes-destinos', corpo);
      setEditando(null);
      recarregar();
    } catch (err) {
      setErros(err.campos ?? {});
      setMensagem(err.message);
    }
  }

  async function excluir(f) {
    if (!window.confirm(`Excluir "${f.nome}"?`)) return;
    try {
      await api.delete(`/fontes-destinos/${f.id}`);
      recarregar();
    } catch (err) {
      window.alert(err.message);
    }
  }

  return (
    <section>
      <div className="barra">
        <h2>Fontes e destinos</h2>
        <button type="button" onClick={() => abrir({})}>Nova fonte/destino</button>
      </div>
      <Estado carregando={carregando} erro={erro} recarregar={recarregar}
        vazio={dados?.length === 0} textoVazio="Nenhuma fonte/destino cadastrada.">
        <table>
          <thead><tr><th>Nome</th><th>Tipo</th><th>Fecha / vence</th><th className="num">Limite</th><th /></tr></thead>
          <tbody>
            {dados?.map((f) => (
              <tr key={f.id}>
                <td>{f.nome}{f.reserva ? ' (reserva)' : ''}</td>
                <td>{TIPOS[f.tipo]}</td>
                <td>{f.tipo === 'cartao_credito' ? `dia ${f.diaFechamento} / dia ${f.diaVencimento}` : '—'}</td>
                <td className="num">{f.limite != null ? moeda(f.limite) : '—'}</td>
                <td className="acoes">
                  <button type="button" className="secundario" onClick={() => abrir(f)}>Editar</button>
                  <button type="button" className="perigo" onClick={() => excluir(f)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Estado>

      {editando && (
        <Modal titulo={editando.id ? 'Editar fonte/destino' : 'Nova fonte/destino'} aoFechar={() => setEditando(null)}>
          <form onSubmit={salvar} noValidate>
            {mensagem && <p className="erro-bloco" role="alert">{mensagem}</p>}
            <CampoForm id="nome" rotulo="Nome" erro={erros.nome}>
              <input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </CampoForm>
            <CampoForm id="tipo" rotulo="Tipo" erro={erros.tipo}>
              <select id="tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {Object.entries(TIPOS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </CampoForm>
            {form.tipo === 'cartao_credito' && (
              <>
                <CampoForm id="diaFechamento" rotulo="Dia de fechamento (1–31)" erro={erros.diaFechamento}>
                  <input id="diaFechamento" type="number" min="1" max="31" value={form.diaFechamento}
                    onChange={(e) => setForm({ ...form, diaFechamento: e.target.value })} />
                </CampoForm>
                <CampoForm id="diaVencimento" rotulo="Dia de vencimento (1–31)" erro={erros.diaVencimento}>
                  <input id="diaVencimento" type="number" min="1" max="31" value={form.diaVencimento}
                    onChange={(e) => setForm({ ...form, diaVencimento: e.target.value })} />
                </CampoForm>
                <CampoForm id="limite" rotulo="Limite (R$)" erro={erros.limite}>
                  <input id="limite" inputMode="numeric" value={form.limite}
                    onChange={(e) => setForm({ ...form, limite: mascararValor(e.target.value) })} />
                </CampoForm>
              </>
            )}
            {form.tipo === 'conta' && (
              <label>
                <input type="checkbox" style={{ width: 'auto' }} checked={form.reserva}
                  onChange={(e) => setForm({ ...form, reserva: e.target.checked })} />{' '}
                Conta de reserva de emergência
              </label>
            )}
            <p><button type="submit">Salvar</button></p>
          </form>
        </Modal>
      )}
    </section>
  );
}
