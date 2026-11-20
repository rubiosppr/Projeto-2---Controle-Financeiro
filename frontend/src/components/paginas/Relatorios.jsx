import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../../services/api.js';
import { useCarregar } from '../../utils/useCarregar.js';
import { dataBR, mesAtual, moeda, percentual } from '../../utils/formatar.js';
import { Estado } from '../comuns/Estados.jsx';
import CampoForm from '../comuns/CampoForm.jsx';

const CORES = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c'];

function PorCategoria({ inicio, fim }) {
  const { dados, carregando, erro, recarregar } = useCarregar(
    () => api.get(`/relatorios/categorias?inicio=${inicio}&fim=${fim}`), [inicio, fim]);
  const vazio = dados && dados.categorias.length === 0 && dados.entradas.length === 0;

  return (
    <Estado carregando={carregando} erro={erro} recarregar={recarregar} vazio={vazio} textoVazio="Sem movimentações no período.">
      {dados && (
        <>
          <p>
            Comparando com {dataBR(dados.periodoAnterior.inicio)} a {dataBR(dados.periodoAnterior.fim)}.
            Total de saídas: <strong className="saida">{moeda(dados.totalSaidas)}</strong> · Total de entradas:{' '}
            <strong className="entrada">{moeda(dados.totalEntradas)}</strong>
          </p>
          {dados.categorias.some((c) => c.total > 0) && (
            <div className="grafico">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dados.categorias.filter((c) => c.total > 0)} dataKey="total" nameKey="nome"
                    innerRadius={60} outerRadius={110} label={(e) => e.nome}>
                    {dados.categorias.filter((c) => c.total > 0).map((c, i) => <Cell key={c.id} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => moeda(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <h3>Saídas por categoria</h3>
          <table>
            <thead>
              <tr><th>Categoria</th><th className="num">Total</th><th className="num">%</th>
                <th className="num">Período anterior</th><th className="num">Variação</th></tr>
            </thead>
            <tbody>
              {dados.categorias.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td className="num">{moeda(c.total)}</td>
                  <td className="num">{percentual(c.percentual)}</td>
                  <td className="num">{moeda(c.periodoAnterior)}</td>
                  <td className={`num ${c.variacao > 0 ? 'saida' : c.variacao < 0 ? 'entrada' : ''}`}>
                    {c.variacao > 0 ? '▲ aumento ' : c.variacao < 0 ? '▼ redução ' : '= '}{moeda(Math.abs(c.variacao))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 style={{ marginTop: '1.5rem' }}>Entradas por categoria</h3>
          {dados.entradas.length === 0 ? <p className="estado">Sem entradas no período.</p> : (
            <table>
              <thead><tr><th>Categoria</th><th className="num">Total</th></tr></thead>
              <tbody>
                {dados.entradas.map((c) => (
                  <tr key={c.id}><td>{c.nome}</td><td className="num entrada">{moeda(c.total)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </Estado>
  );
}

function PorFonteDestino({ inicio, fim }) {
  const { dados, carregando, erro, recarregar } = useCarregar(
    () => api.get(`/relatorios/fontes-destinos?inicio=${inicio}&fim=${fim}`), [inicio, fim]);
  const vazio = dados && dados.itens.every((i) => i.entradas === 0 && i.saidas === 0);

  return (
    <Estado carregando={carregando} erro={erro} recarregar={recarregar} vazio={vazio} textoVazio="Sem movimentações no período.">
      {dados && (
        <>
          <div className="grafico">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados.itens}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" />
                <YAxis tickFormatter={(v) => moeda(v)} width={90} />
                <Tooltip formatter={(v) => moeda(v)} />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="#16a34a" />
                <Bar dataKey="saidas" name="Saídas" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table>
            <thead>
              <tr><th>Fonte/destino</th><th>Tipo</th><th className="num">Entradas</th><th className="num">Saídas</th><th className="num">Saldo</th></tr>
            </thead>
            <tbody>
              {dados.itens.map((i) => (
                <tr key={i.id}>
                  <td>{i.nome}</td>
                  <td>{{ renda: 'Renda', conta: 'Conta', cartao_credito: 'Cartão' }[i.tipo]}</td>
                  <td className="num entrada">{moeda(i.entradas)}</td>
                  <td className="num saida">{moeda(i.saidas)}</td>
                  <td className={`num ${i.saldo != null && i.saldo < 0 ? 'saida' : ''}`}>{i.saldo != null ? moeda(i.saldo) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Estado>
  );
}

export default function Relatorios() {
  const [aba, setAba] = useState('categorias');
  const [periodo, setPeriodo] = useState(mesAtual());
  const periodoOk = periodo.inicio && periodo.fim && periodo.inicio <= periodo.fim;

  return (
    <section>
      <h2>Relatórios</h2>
      <div className="abas">
        <button type="button" className={aba === 'categorias' ? 'ativa' : ''} onClick={() => setAba('categorias')}>Por categoria</button>
        <button type="button" className={aba === 'fontes' ? 'ativa' : ''} onClick={() => setAba('fontes')}>Por fonte/destino</button>
      </div>
      <div className="barra">
        <CampoForm id="r-inicio" rotulo="De">
          <input id="r-inicio" type="date" value={periodo.inicio} onChange={(e) => setPeriodo({ ...periodo, inicio: e.target.value })} />
        </CampoForm>
        <CampoForm id="r-fim" rotulo="Até">
          <input id="r-fim" type="date" value={periodo.fim} onChange={(e) => setPeriodo({ ...periodo, fim: e.target.value })} />
        </CampoForm>
      </div>
      {!periodoOk ? <p className="erro-bloco" role="alert">Informe um período válido (a data inicial não pode ser maior que a final).</p>
        : aba === 'categorias' ? <PorCategoria inicio={periodo.inicio} fim={periodo.fim} />
        : <PorFonteDestino inicio={periodo.inicio} fim={periodo.fim} />}
    </section>
  );
}
