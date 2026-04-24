import { BrowserRouter, Route, Routes } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import CalendarioPage from './pages/CalendarioPage';
import DashboardPage from './pages/DashboardPage';
import DegustacaoPage from './pages/DegustacaoPage';
import EstatisticasPage from './pages/EstatisticasPage';
import EventoDetailPage from './pages/EventoDetailPage';
import EventosPage from './pages/EventosPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#faf8f5]">
        <Routes>
          <Route path="/"               element={<DashboardPage />} />
          <Route path="/eventos"        element={<EventosPage />} />
          <Route path="/eventos/:id"    element={<EventoDetailPage />} />
          <Route path="/calendario"     element={<CalendarioPage />} />
          <Route path="/degustacoes"    element={<DegustacaoPage />} />
          <Route path="/estatisticas"   element={<EstatisticasPage />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
