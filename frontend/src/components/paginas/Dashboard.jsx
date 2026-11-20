import { useAuth } from '../../contexts/AuthContext.jsx';

export default function Dashboard() {
  const { usuario } = useAuth();
  return (
    <section>
      <h2>Olá, {usuario?.nome}</h2>
      <p>Use o menu para começar.</p>
    </section>
  );
}
