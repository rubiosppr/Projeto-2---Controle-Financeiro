import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import RotaProtegida from './components/layout/RotaProtegida.jsx';
import Login from './components/paginas/Login.jsx';
import Cadastro from './components/paginas/Cadastro.jsx';
import Dashboard from './components/paginas/Dashboard.jsx';
import Categorias from './components/paginas/Categorias.jsx';
import FontesDestinos from './components/paginas/FontesDestinos.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route element={<RotaProtegida />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/categorias" element={<Categorias />} />
            <Route path="/fontes-destinos" element={<FontesDestinos />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
