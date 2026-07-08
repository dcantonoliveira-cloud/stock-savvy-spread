import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import CalendarioPage from './pages/CalendarioPage';
import DashboardPage from './pages/DashboardPage';
import DegustacaoDetailPage from './pages/DegustacaoDetailPage';
import DegustacaoPage from './pages/DegustacaoPage';
import EstatisticasPage from './pages/EstatisticasPage';
import EventoDetailPage from './pages/EventoDetailPage';
import EventosPage from './pages/EventosPage';
import MenuPublicoPage from './pages/MenuPublicoPage';
import OrcamentosPage from './pages/OrcamentosPage';

function AppShell() {
  const { pathname } = useLocation();
  const isPublic = pathname.startsWith('/menu/');

  return (
    <div className="min-h-screen bg-[#f2f2f2]">
      <Routes>
        <Route path="/"                   element={<DashboardPage />}         />
        <Route path="/eventos"            element={<EventosPage />}           />
        <Route path="/eventos/:id"        element={<EventoDetailPage />}      />
        <Route path="/calendario"         element={<CalendarioPage />}        />
        <Route path="/orcamentos"         element={<OrcamentosPage />}        />
        <Route path="/degustacoes"        element={<DegustacaoPage />}        />
        <Route path="/degustacoes/:id"    element={<DegustacaoDetailPage />}  />
        <Route path="/estatisticas"       element={<EstatisticasPage />}      />
        <Route path="/menu/:id"           element={<MenuPublicoPage />}       />
      </Routes>
      {!isPublic && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
