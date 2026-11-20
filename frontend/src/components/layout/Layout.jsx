import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

const LINKS = [
  ['/', 'Dashboard'],
  ['/lancamentos', 'Lançamentos'],
  ['/categorias', 'Categorias'],
  ['/fontes-destinos', 'Fontes/Destinos'],
  ['/relatorios', 'Relatórios'],
  ['/faturas', 'Faturas'],
  ['/saude-financeira', 'Saúde financeira'],
];

export default function Layout() {
  const { usuario, logout } = useAuth();
  return (
    <div className="app">
      <aside className="menu">
        <h1>Controle Financeiro</h1>
        <nav>
          {LINKS.map(([para, texto]) => (
            <NavLink key={para} to={para} end={para === '/'}>{texto}</NavLink>
          ))}
        </nav>
        <div className="menu-rodape">
          <span>{usuario?.nome}</span>
          <button type="button" onClick={logout}>Sair</button>
        </div>
      </aside>
      <main className="conteudo"><Outlet /></main>
    </div>
  );
}
