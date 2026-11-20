import { api } from '../../services/api.js';
import { useCarregar } from '../../utils/useCarregar.js';
import { dataBR, moeda } from '../../utils/formatar.js';
import { Estado } from '../comuns/Estados.jsx';

function Fatura({ fatura }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <h4 style={{ margin: '0 0 .4rem' }}>
        {fatura.atual ? 'Fatura atual (aberta)' : fatura.fechada ? 'Fatura fechada (aguardando pagamento)' : 'Previsão'} — vence em {dataBR(fatura.vencimento)}
        <small> (fecha em {dataBR(fatura.fechamento)})</small>
      </h4>
      {fatura.lancamentos.length === 0 ? <p className="estado">Sem lançamentos nesta fatura.</p> : (
        <table>
          <thead><tr><th>Data da compra</th><th>Descrição</th><th>Categoria</th><th className="num">Valor</th></tr></thead>
          <tbody>
            {fatura.lancamentos.map((l) => (
              <tr key={l.id}>
                <td>{dataBR(l.data)}</td>
                <td>{l.descricao}{l.totalParcelas > 1 ? ` — ${l.parcelaAtual}/${l.totalParcelas}` : ''}</td>
                <td>{l.categoriaNome}</td>
                <td className="num">{moeda(l.valor)}</td>
              </tr>
            ))}
            <tr><th colSpan={3}>Total da fatura</th><th className="num">{moeda(fatura.total)}</th></tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Faturas() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/relatorios/faturas?meses=3'), []);
  return (
    <section>
      <h2>Faturas dos cartões</h2>
      <Estado carregando={carregando} erro={erro} recarregar={recarregar} vazio={dados?.length === 0}
        textoVazio="Você ainda não tem cartão de crédito. Cadastre um em Fontes/Destinos.">
        {dados?.map((c) => (
          <article key={c.cartaoId} className="card" style={{ marginBottom: '1.5rem' }}>
            <h3>{c.nome}</h3>
            <div className="cards">
              <div className="card"><small>Limite</small><strong>{moeda(c.limite)}</strong></div>
              <div className="card"><small>Utilizado</small><strong className="saida">{moeda(c.limiteUtilizado)}</strong></div>
              <div className="card"><small>Disponível</small>
                <strong className={c.limiteDisponivel >= 0 ? 'entrada' : 'saida'}>{moeda(c.limiteDisponivel)}</strong></div>
            </div>
            {c.faturas.map((f) => <Fatura key={f.referencia} fatura={f} />)}
          </article>
        ))}
      </Estado>
    </section>
  );
}
