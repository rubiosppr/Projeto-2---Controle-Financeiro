import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useCarregar } from '../../utils/useCarregar.js';
import { dataBR, mesAtual, mesExtenso, moeda } from '../../utils/formatar.js';
import { Estado } from '../comuns/Estados.jsx';

export default function Dashboard() {
  const { usuario } = useAuth();
  const { inicio, fim } = mesAtual();
  const { dados, carregando, erro, recarregar } = useCarregar(
    () => api.get(`/lancamentos?inicio=${inicio}&fim=${fim}&limite=5`), [inicio, fim]);

  return (
    <section>
      <h2>Olá, {usuario?.nome}</h2>
      <p>Resumo de {mesExtenso(inicio.slice(0, 7))}</p>
      <Estado carregando={carregando} erro={erro} recarregar={recarregar}>
        {dados && (
          <>
            <div className="cards">
              <div className="card"><small>Entradas</small><strong className="entrada">{moeda(dados.totais.entradas)}</strong></div>
              <div className="card"><small>Saídas</small><strong className="saida">{moeda(dados.totais.saidas)}</strong></div>
              <div className="card"><small>Saldo</small>
                <strong className={dados.totais.saldo >= 0 ? 'entrada' : 'saida'}>{moeda(dados.totais.saldo)}</strong></div>
            </div>
            <h3>Últimos lançamentos</h3>
            {dados.itens.length === 0 ? (
              <p className="estado">Nenhum lançamento neste mês. <Link to="/lancamentos">Adicionar</Link></p>
            ) : (
              <table>
                <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="num">Valor</th></tr></thead>
                <tbody>
                  {dados.itens.map((l) => (
                    <tr key={l.id}>
                      <td>{dataBR(l.data)}</td>
                      <td>{l.descricao}{l.totalParcelas > 1 ? ` — ${l.parcelaAtual}/${l.totalParcelas}` : ''}</td>
                      <td>{l.categoriaNome}</td>
                      <td className={`num ${l.tipo}`}>{l.tipo === 'saida' ? '−' : '+'} {moeda(l.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p><Link to="/lancamentos">Ver todos os lançamentos</Link></p>
          </>
        )}
      </Estado>
    </section>
  );
}
