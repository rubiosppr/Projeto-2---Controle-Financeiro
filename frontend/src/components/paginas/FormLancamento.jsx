import { useState } from 'react';
import { api } from '../../services/api.js';
import { hojeISO } from '../../utils/formatar.js';
import { mascararValor, numeroParaCampo, valorParaNumero } from '../../utils/mascaras.js';
import CampoForm from '../comuns/CampoForm.jsx';

export default function FormLancamento({ lancamento, categorias, fontes, aoSalvar, aoCancelar }) {
  const edicao = Boolean(lancamento?.id);
  const [form, setForm] = useState(() => edicao ? {
    tipo: lancamento.tipo, descricao: lancamento.descricao, valor: numeroParaCampo(lancamento.valor),
    data: lancamento.data, categoriaId: String(lancamento.categoriaId),
    fonteDestinoId: String(lancamento.fonteDestinoId), totalParcelas: '1',
  } : {
    tipo: 'saida', descricao: '', valor: '', data: hojeISO(), categoriaId: '', fonteDestinoId: '', totalParcelas: '1',
  });
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  const fonte = fontes.find((f) => String(f.id) === form.fonteDestinoId);
  const podeParcelar = !edicao && form.tipo === 'saida' && fonte?.tipo === 'cartao_credito';
  const categoriasDoTipo = categorias.filter((c) => c.tipo === form.tipo);
  const mudar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setMensagem('');
    const corpo = {
      tipo: form.tipo,
      descricao: form.descricao,
      valor: form.valor ? valorParaNumero(form.valor) : null,
      data: form.data,
      categoriaId: Number(form.categoriaId) || null,
      fonteDestinoId: Number(form.fonteDestinoId) || null,
      ...(podeParcelar && { totalParcelas: Number(form.totalParcelas) || 1 }),
    };
    setEnviando(true);
    try {
      if (edicao) await api.put(`/lancamentos/${lancamento.id}`, corpo);
      else await api.post('/lancamentos', corpo);
      aoSalvar();
    } catch (erro) {
      setErros(erro.campos ?? {});
      setMensagem(erro.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      {mensagem && <p className="erro-bloco" role="alert">{mensagem}</p>}
      <CampoForm id="tipo" rotulo="Tipo" erro={erros.tipo}>
        <select id="tipo" value={form.tipo} disabled={edicao && lancamento.totalParcelas > 1}
          onChange={(e) => setForm({ ...form, tipo: e.target.value, categoriaId: '' })}>
          <option value="saida">Saída</option>
          <option value="entrada">Entrada</option>
        </select>
      </CampoForm>
      <CampoForm id="descricao" rotulo="Descrição" erro={erros.descricao}>
        <input id="descricao" value={form.descricao} onChange={mudar('descricao')} />
      </CampoForm>
      <CampoForm id="valor" rotulo="Valor (R$)" erro={erros.valor}>
        <input id="valor" inputMode="numeric" value={form.valor}
          onChange={(e) => setForm({ ...form, valor: mascararValor(e.target.value) })} />
      </CampoForm>
      <CampoForm id="data" rotulo="Data" erro={erros.data}>
        <input id="data" type="date" value={form.data} onChange={mudar('data')} />
      </CampoForm>
      <CampoForm id="categoriaId" rotulo="Categoria" erro={erros.categoriaId}>
        <select id="categoriaId" value={form.categoriaId} onChange={mudar('categoriaId')}>
          <option value="">Selecione…</option>
          {categoriasDoTipo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </CampoForm>
      <CampoForm id="fonteDestinoId" rotulo={form.tipo === 'entrada' ? 'Fonte' : 'Destino'} erro={erros.fonteDestinoId}>
        <select id="fonteDestinoId" value={form.fonteDestinoId} disabled={edicao && lancamento.totalParcelas > 1}
          onChange={mudar('fonteDestinoId')}>
          <option value="">Selecione…</option>
          {fontes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </CampoForm>
      {podeParcelar && (
        <CampoForm id="totalParcelas" rotulo="Parcelas (1 a 48)" erro={erros.totalParcelas}>
          <input id="totalParcelas" type="number" min="1" max="48" value={form.totalParcelas} onChange={mudar('totalParcelas')} />
        </CampoForm>
      )}
      {edicao && lancamento.totalParcelas > 1 && (
        <p className="estado">A edição altera apenas a parcela {lancamento.parcelaAtual}/{lancamento.totalParcelas}.</p>
      )}
      <div className="acoes">
        <button type="submit" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button>
        <button type="button" className="secundario" onClick={aoCancelar}>Cancelar</button>
      </div>
    </form>
  );
}
