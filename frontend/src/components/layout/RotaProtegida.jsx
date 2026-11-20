import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { Carregando } from '../comuns/Estados.jsx';
import Layout from './Layout.jsx';

export default function RotaProtegida() {
  const { token, carregando } = useAuth();
  if (carregando) return <Carregando />;
  return token ? <Layout /> : <Navigate to="/login" replace />;
}
