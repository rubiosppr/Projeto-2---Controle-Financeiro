import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../services/api.js';
import { useCarregar } from '../../utils/useCarregar.js';
import { mesExtenso, moeda, percentual } from '../../utils/formatar.js';
import { Estado } from '../comuns/Estados.jsx';

const pct = (v) => (v === null || v === undefined ? '—' : percentual(v));

export default function SaudeFinanceira() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/saude-financeira'), []);
  const ind = dados?.indicadores;

  return (
    <section>
      <h2>Saúde financeira</h2>
      <p className="aviso" role="note">{dados?.aviso ?? 'As informações desta página são educativas e não constituem recomendação financeira profissional.'}</p>
      <Estado carregando={carregando} erro={erro} recarregar={recarregar}>
        {dados && (
          <>
            <div className="cards">
              <div className="card"><small>Taxa de poupança (mês anterior)</small><strong>{pct(ind.taxaPoupanca.mesAnterior)}</strong></div>
              <div className="card"><small>Faturas × renda (3 meses)</small><strong>{pct(ind.comprometimentoCartoes.percentual)}</strong></div>
              <div className="card"><small>Parcelas a vencer</small><strong>{moeda(ind.parcelasFuturas.total)}</strong></div>
              <div className="card"><small>Reserva de emergência</small>
                <strong>{ind.reservaEmergencia.mesesCobertos !== null
                  ? `${ind.reservaEmergencia.mesesCobertos.toLocaleString('pt-BR')} mês(es)` : '—'}</strong></div>
            </div>

            <h3>Dicas</h3>
            {dados.dicas.map((d, i) => <div key={i} className={`dica ${d.tipo}`}>{d.texto}</div>)}

            <h3 style={{ marginTop: '1.5rem' }}>Projeção de saldo (próximos 6 meses)</h3>
            <div className="grafico">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dados.projecao.map((p) => ({ ...p, rotulo: mesExtenso(p.mes) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rotulo" />
                  <YAxis tickFormatter={(v) => moeda(v)} width={100} />
                  <Tooltip formatter={(v) => moeda(v)} />
                  <ReferenceLine y={0} stroke="#b91c1c" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="saldo" name="Saldo projetado" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="estado">Projeção baseada na média dos últimos 3 meses e nas faturas já conhecidas. Saldo atual estimado: {moeda(dados.saldoAtual)}.</p>

            {ind.categoriasForaDaCurva.length > 0 && (
              <>
                <h3>Categorias fora da curva</h3>
                <table>
                  <thead><tr><th>Categoria</th><th className="num">Este mês</th><th className="num">Média (3 meses)</th><th className="num">Acima</th></tr></thead>
                  <tbody>
                    {ind.categoriasForaDaCurva.map((c) => (
                      <tr key={c.categoria}>
                        <td>{c.categoria}</td><td className="num">{moeda(c.atual)}</td>
                        <td className="num">{moeda(c.media)}</td><td className="num saida">{pct(c.percentualAcima)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </Estado>
    </section>
  );
}
