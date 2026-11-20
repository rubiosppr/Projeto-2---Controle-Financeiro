import { useState } from 'react';
import { api } from '../../services/api.js';
import { useCarregar } from '../../utils/useCarregar.js';
import { dataBR, mesAtual, moeda } from '../../utils/formatar.js';
import { Estado } from '../comuns/Estados.jsx';
import Modal from '../comuns/Modal.jsx';
import ModalConfirmar from '../comuns/ModalConfirmar.jsx';
import Paginacao from '../comuns/Paginacao.jsx';
import CampoForm from '../comuns/CampoForm.jsx';
import FormLancamento from './FormLancamento.jsx';

export default function Lancamentos() {
  const [filtros, setFiltros] = useState({ ...mesAtual(), tipo: '', categoriaId: '', fonteDestinoId: '', pagina: 1 });
  const [editando, setEditando] = useState(null); // null fechado; {} novo; objeto = edição
  const [excluindo, setExcluindo] = useState(null);
  const [erroAcao, setErroAcao] = useState('');

  const refs = useCarregar(async () => {
    const [categorias, fontes] = await Promise.all([api.get('/categorias'), api.get('/fontes-destinos')]);
    return { categorias, fontes };
  }, []);

  const consulta = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== '')).toString();
  const lista = useCarregar(() => api.get(`/lancamentos?${consulta}`), [consulta]);

  const mudar = (campo) => (e) => setFiltros({ ...filtros, [campo]: e.target.value, pagina: 1 });

  async function excluir(todasParcelas) {
    try {
      await api.delete(`/lancamentos/${excluindo.id}${todasParcelas ? '?todasParcelas=true' : ''}`);
      setExcluindo(null);
      lista.recarregar();
    } catch (e) {
      setErroAcao(e.message);
      setExcluindo(null);
    }
  }

  const { itens = [], totais, paginacao } = lista.dados ?? {};

  return (
    <section>
      <div className="barra">
        <h2>Lançamentos</h2>
        <button type="button" disabled={!refs.dados} onClick={() => setEditando({})}>Novo lançamento</button>
      </div>
      {erroAcao && <p className="erro-bloco" role="alert">{erroAcao}</p>}

      <div className="barra">
        <CampoForm id="f-inicio" rotulo="De"><input id="f-inicio" type="date" value={filtros.inicio} onChange={mudar('inicio')} /></CampoForm>
        <CampoForm id="f-fim" rotulo="Até"><input id="f-fim" type="date" value={filtros.fim} onChange={mudar('fim')} /></CampoForm>
        <CampoForm id="f-tipo" rotulo="Tipo">
          <select id="f-tipo" value={filtros.tipo} onChange={mudar('tipo')}>
            <option value="">Todos</option><option value="entrada">Entrada</option><option value="saida">Saída</option>
          </select>
        </CampoForm>
        <CampoForm id="f-cat" rotulo="Categoria">
          <select id="f-cat" value={filtros.categoriaId} onChange={mudar('categoriaId')}>
            <option value="">Todas</option>
            {refs.dados?.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.tipo === 'entrada' ? 'E' : 'S'})</option>)}
          </select>
        </CampoForm>
        <CampoForm id="f-fonte" rotulo="Fonte/destino">
          <select id="f-fonte" value={filtros.fonteDestinoId} onChange={mudar('fonteDestinoId')}>
            <option value="">Todas</option>
            {refs.dados?.fontes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </CampoForm>
      </div>

      {totais && (
        <div className="cards">
          <div className="card"><small>Entradas</small><strong className="entrada">{moeda(totais.entradas)}</strong></div>
          <div className="card"><small>Saídas</small><strong className="saida">{moeda(totais.saidas)}</strong></div>
          <div className="card"><small>Saldo</small><strong className={totais.saldo >= 0 ? 'entrada' : 'saida'}>{moeda(totais.saldo)}</strong></div>
        </div>
      )}

      <Estado carregando={lista.carregando} erro={lista.erro} recarregar={lista.recarregar}
        vazio={itens.length === 0} textoVazio="Nenhum lançamento no período.">
        <table>
          <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Fonte/destino</th><th className="num">Valor</th><th /></tr></thead>
          <tbody>
            {itens.map((l) => (
              <tr key={l.id}>
                <td>{dataBR(l.data)}</td>
                <td>{l.descricao}{l.totalParcelas > 1 ? ` — ${l.parcelaAtual}/${l.totalParcelas}` : ''}</td>
                <td>{l.categoriaNome}</td>
                <td>{l.fonteDestinoNome}</td>
                <td className={`num ${l.tipo}`}>{l.tipo === 'saida' ? '−' : '+'} {moeda(l.valor)}</td>
                <td className="acoes">
                  <button type="button" className="secundario" onClick={() => setEditando(l)}>Editar</button>
                  <button type="button" className="perigo" onClick={() => setExcluindo(l)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {paginacao && (
          <Paginacao pagina={paginacao.pagina} paginas={paginacao.paginas}
            aoMudar={(p) => setFiltros({ ...filtros, pagina: p })} />
        )}
      </Estado>

      {editando && refs.dados && (
        <Modal titulo={editando.id ? 'Editar lançamento' : 'Novo lançamento'} aoFechar={() => setEditando(null)}>
          <FormLancamento lancamento={editando} categorias={refs.dados.categorias} fontes={refs.dados.fontes}
            aoCancelar={() => setEditando(null)}
            aoSalvar={() => { setEditando(null); setErroAcao(''); lista.recarregar(); }} />
        </Modal>
      )}

      {excluindo && (
        <ModalConfirmar titulo="Excluir lançamento" aoFechar={() => setExcluindo(null)}
          mensagem={excluindo.totalParcelas > 1
            ? `"${excluindo.descricao}" é parcela ${excluindo.parcelaAtual}/${excluindo.totalParcelas}. Excluir apenas esta ou todas as parcelas da compra?`
            : `Excluir "${excluindo.descricao}" (${moeda(excluindo.valor)})?`}>
          {excluindo.totalParcelas > 1 ? (
            <>
              <button type="button" className="perigo" onClick={() => excluir(false)}>Só esta</button>
              <button type="button" className="perigo" onClick={() => excluir(true)}>Todas as parcelas</button>
            </>
          ) : (
            <button type="button" className="perigo" onClick={() => excluir(false)}>Excluir</button>
          )}
        </ModalConfirmar>
      )}
    </section>
  );
}
