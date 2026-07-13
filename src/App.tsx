import { lazy, Suspense, useState, useEffect } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// ─── Layouts (carregam cedo, são pequenos) ───
import SupervisorLayout from "./components/SupervisorLayout";
import SupervisorRouteGuard from "./components/SupervisorRouteGuard";
import EmployeeLayout from "./components/EmployeeLayout";

// ─── Auth (sempre necessários na primeira tela) ───
import LoginPage from "./pages/auth/LoginPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import NoRolePage from "./pages/auth/NoRolePage";

// ─── Supervisor pages (lazy) ───
const SupervisorDashboard      = lazy(() => import("./pages/supervisor/SupervisorDashboard"));
const StockItemsPage           = lazy(() => import("./pages/supervisor/StockItemsPage"));
const EntriesPage              = lazy(() => import("./pages/supervisor/EntriesPage"));
const SupervisorOutputsPage    = lazy(() => import("./pages/supervisor/OutputsPage"));
const BatchMovementPage        = lazy(() => import("./pages/supervisor/BatchMovementPage"));
const SupervisorSheetsPage     = lazy(() => import("./pages/supervisor/SheetsPage"));
const SheetDetailPage          = lazy(() => import("./pages/supervisor/SheetDetailPage"));
const SupervisorComparisonPage = lazy(() => import("./pages/supervisor/ComparisonPage"));
const UsersPage                = lazy(() => import("./pages/supervisor/UsersPage"));
const NotificationsPage        = lazy(() => import("./pages/supervisor/NotificationsPage"));
const AIAnalysisPage           = lazy(() => import("./pages/supervisor/AIAnalysisPage"));
const EstatisticasPage         = lazy(() => import("./pages/supervisor/EstatisticasPage"));
const SupervisorProducaoPage   = lazy(() => import("./pages/supervisor/ProducaoPage"));
const EmployeeDetailPage       = lazy(() => import("./pages/supervisor/EmployeeDetailPage"));
const CategoriesPage           = lazy(() => import("./pages/supervisor/CategoriesPage"));
const TagsPage                 = lazy(() => import("./pages/supervisor/TagsPage"));
const CategoryDetailPage       = lazy(() => import("./pages/supervisor/CategoryDetailPage"));
const StockItemDetailPage      = lazy(() => import("./pages/supervisor/StockItemDetailPage"));
const InventoryPage            = lazy(() => import("./pages/supervisor/InventoryPage"));
const KitchensPage             = lazy(() => import("./pages/supervisor/KitchensPage"));
const KitchenDetailPage        = lazy(() => import("./pages/supervisor/KitchenDetailPage"));
const TransfersPage            = lazy(() => import("./pages/supervisor/TransfersPage"));
const EventMenusPage           = lazy(() => import("./pages/supervisor/EventMenusPage"));
const EventMenuDetailPage      = lazy(() => import("./pages/supervisor/EventMenuDetailPage"));
const FornecedoresPage         = lazy(() => import("./pages/supervisor/FornecedoresPage"));
const FornecedorDetailPage     = lazy(() => import("./pages/supervisor/FornecedorDetailPage"));
const ShoppingListsPage        = lazy(() => import("./pages/supervisor/ShoppingListsPage"));
const ShoppingListDetailPage   = lazy(() => import("./pages/supervisor/ShoppingListDetailPage"));
const MobileSupervisorApp      = lazy(() => import("./pages/supervisor/MobileSupervisorApp"));
const ClientsPage              = lazy(() => import("./pages/supervisor/crm/ClientsPage"));
const ProdutosPage             = lazy(() => import("./pages/supervisor/cadastros/ProdutosPage"));
const SaloesPage               = lazy(() => import("./pages/supervisor/cadastros/SaloesPage"));
const TiposFestPage            = lazy(() => import("./pages/supervisor/cadastros/TiposFestPage"));
const AssessoresPage           = lazy(() => import("./pages/supervisor/cadastros/AssessoresPage"));
const DecoradoresPage          = lazy(() => import("./pages/supervisor/cadastros/DecoradoresPage"));
const ContratosPage            = lazy(() => import("./pages/supervisor/cadastros/ContratosPage"));
const ChecklistsPage           = lazy(() => import("./pages/supervisor/cadastros/ChecklistsPage"));
const MensagensPage            = lazy(() => import("./pages/supervisor/cadastros/MensagensPage"));
const NotificacoesGruposPage   = lazy(() => import("./pages/supervisor/cadastros/NotificacoesGruposPage"));
const ConfiguracoesPage        = lazy(() => import("./pages/supervisor/ConfiguracoesPage"));
const MeuPerfilPage            = lazy(() => import("./pages/supervisor/MeuPerfilPage"));
const EventsPage               = lazy(() => import("./pages/supervisor/crm/EventsPage"));
const EventDetailPage          = lazy(() => import("./pages/supervisor/crm/EventDetailPage"));
const OrcamentosPage           = lazy(() => import("./pages/supervisor/crm/OrcamentosPage"));
const TastingsPage             = lazy(() => import("./pages/supervisor/crm/TastingsPage"));
const TastingDetailPage        = lazy(() => import("./pages/supervisor/crm/TastingDetailPage"));
const CalendarPage             = lazy(() => import("./pages/supervisor/crm/CalendarPage"));
const FinanceiroPage           = lazy(() => import("./pages/supervisor/FinanceiroPage"));
const FluxoCaixaPage           = lazy(() => import("./pages/supervisor/FluxoCaixaPage"));
const ContasReceberPage        = lazy(() => import("./pages/supervisor/financeiro/ContasReceberPage"));
const ContasPagarPage          = lazy(() => import("./pages/supervisor/financeiro/ContasPagarPage"));
const TransferenciasFinPage    = lazy(() => import("./pages/supervisor/financeiro/TransferenciasPage"));
const ExtratoBancarioPage      = lazy(() => import("./pages/supervisor/financeiro/ExtratoBancarioPage"));
const ConciliacaoPage          = lazy(() => import("./pages/supervisor/financeiro/ConciliacaoPage"));
const CartoesPage              = lazy(() => import("./pages/supervisor/financeiro/CartoesPage"));
const DREPage                  = lazy(() => import("./pages/supervisor/financeiro/DREPage"));
const RelatoriosFinPage        = lazy(() => import("./pages/supervisor/financeiro/RelatoriosPage"));
const MateriaisInventarioPage  = lazy(() => import("./pages/supervisor/materiais/MateriaisInventarioPage"));
const MateriaisCategoriasPage  = lazy(() => import("./pages/supervisor/materiais/MateriaisCategoriasPage"));
const EmprestimosPage          = lazy(() => import("./pages/supervisor/materiais/EmprestimosPage"));
const PerdasPage               = lazy(() => import("./pages/supervisor/materiais/PerdasPage"));
const ListaBasePage            = lazy(() => import("./pages/supervisor/materiais/ListaBasePage"));

// ─── Employee pages (lazy) ───
const EmployeeDashboard       = lazy(() => import("./pages/employee/EmployeeDashboard"));
const EmployeeInventoryPage   = lazy(() => import("./pages/employee/EmployeeInventoryPage"));
const EmployeeEventsPage      = lazy(() => import("./pages/employee/EmployeeEventsPage"));
const EmployeeMateriaisPage   = lazy(() => import("./pages/employee/EmployeeMateriaisPage"));
const MyPayslipsPage          = lazy(() => import("./pages/employee/MyPayslipsPage"));
const PayslipSignPage         = lazy(() => import("./pages/employee/PayslipSignPage"));
const ProducaoPage            = lazy(() => import("./pages/employee/ProducaoPage"));
const PayslipsAdminPage       = lazy(() => import("./pages/supervisor/payslips/PayslipsAdminPage"));

// ─── Public pages (lazy) ───
const PublicInventoryPage    = lazy(() => import("./pages/public/PublicInventoryPage"));
const MenuSelectionPage      = lazy(() => import("./pages/public/MenuSelectionPage"));
const ClientRegisterPage     = lazy(() => import("./pages/public/ClientRegisterPage"));
const ContractFormPage       = lazy(() => import("./pages/public/ContractFormPage"));

// ─── Client portal (lazy) ───
const ClientPortalLayout     = lazy(() => import("./pages/portal/ClientPortalLayout"));
const PortalEventoPage       = lazy(() => import("./pages/portal/PortalEventoPage"));
const PortalFinanceiroPage   = lazy(() => import("./pages/portal/PortalFinanceiroPage"));
const PortalArquivosPage     = lazy(() => import("./pages/portal/PortalArquivosPage"));
const PortalInformacoesPage  = lazy(() => import("./pages/portal/PortalInformacoesPage"));
const PortalChecklistPage    = lazy(() => import("./pages/portal/PortalChecklistPage"));

const queryClient = new QueryClient();

// ─── Fallback de carregamento ───
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function AppRoutes() {
  const { user, role, loading, permissions } = useAuth();
  const isMobile = useIsMobile();

  // Rotas públicas — bypass completo de auth (não espera loading do Supabase)
  if (window.location.pathname === '/menu') {
    const CardapioPublicoPage = lazy(() => import('./pages/public/CardapioPublicoPage'));
    return <Suspense fallback={<PageLoader />}><CardapioPublicoPage /></Suspense>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold gold-text mb-2">RONDELLO</h1>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Rotas públicas — acessíveis sem login
    if (window.location.pathname === '/menu') {
      const CardapioPublicoPage = lazy(() => import('./pages/public/CardapioPublicoPage'));
      return <Suspense fallback={<PageLoader />}><CardapioPublicoPage /></Suspense>;
    }
    if (window.location.pathname.startsWith('/portal/cadastro')) {
      return <Suspense fallback={<PageLoader />}><ClientRegisterPage /></Suspense>;
    }
    if (window.location.pathname.startsWith('/contrato-cliente/')) {
      return <Suspense fallback={<PageLoader />}><ContractFormPage /></Suspense>;
    }
    // Link de recovery do Supabase chega com #type=recovery no hash
    if (window.location.hash.includes('type=recovery')) {
      return <ResetPasswordPage />;
    }
    return <LoginPage />;
  }
  if (!role) return <NoRolePage />;

  if (role === 'client') {
    return (
      <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/portal" element={<ClientPortalLayout />}>
            <Route index element={<PortalEventoPage />} />
            <Route path="financeiro"  element={<PortalFinanceiroPage />} />
            <Route path="arquivos"    element={<PortalArquivosPage />} />
            <Route path="informacoes" element={<PortalInformacoesPage />} />
            <Route path="checklist"   element={<PortalChecklistPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    );
  }

  if (role === 'supervisor') {
    if (isMobile) {
      return (
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <MobileSupervisorApp />
        </Suspense>
        </ErrorBoundary>
      );
    }
    return (
      <SupervisorLayout>
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <SupervisorRouteGuard>
          <Routes>
            <Route path="/" element={<SupervisorDashboard />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/orcamentos" element={<OrcamentosPage />} />
            <Route path="/orcamentos/:id" element={<EventDetailPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/cadastros/produtos" element={<ProdutosPage />} />
            <Route path="/cadastros/saloes" element={<SaloesPage />} />
            <Route path="/cadastros/tipos-festa" element={<TiposFestPage />} />
            <Route path="/cadastros/assessores" element={<AssessoresPage />} />
            <Route path="/cadastros/decoradores" element={<DecoradoresPage />} />
            <Route path="/cadastros/contratos" element={<ContratosPage />} />
            <Route path="/cadastros/checklists" element={<ChecklistsPage />} />
            <Route path="/cadastros/mensagens" element={<MensagensPage />} />
            <Route path="/cadastros/notificacoes" element={<NotificacoesGruposPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            <Route path="/meu-perfil" element={<MeuPerfilPage />} />
            <Route path="/tastings" element={<TastingsPage />} />
            <Route path="/tastings/:id" element={<TastingDetailPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/financeiro" element={<FinanceiroPage />} />
            <Route path="/financeiro/fluxo" element={<FluxoCaixaPage />} />
            <Route path="/financeiro/contas-receber" element={<ContasReceberPage />} />
            <Route path="/financeiro/contas-pagar" element={<ContasPagarPage />} />
            <Route path="/financeiro/transferencias" element={<TransferenciasFinPage />} />
            <Route path="/financeiro/extrato" element={<ExtratoBancarioPage />} />
            <Route path="/financeiro/conciliacao" element={<ConciliacaoPage />} />
            <Route path="/financeiro/cartoes" element={<CartoesPage />} />
            <Route path="/financeiro/dre" element={<DREPage />} />
            <Route path="/financeiro/relatorios" element={<RelatoriosFinPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/categories/:name" element={<CategoryDetailPage />} />
            <Route path="/tags" element={<TagsPage />} />
            <Route path="/items" element={<StockItemsPage />} />
            <Route path="/items/:id" element={<StockItemDetailPage />} />
            <Route path="/entries" element={<EntriesPage />} />
            <Route path="/outputs" element={<SupervisorOutputsPage />} />
            <Route path="/batch-movement" element={<BatchMovementPage />} />
            <Route path="/sheets" element={<SupervisorSheetsPage />} />
            <Route path="/sheets/:id" element={<SheetDetailPage />} />
            <Route path="/event-menus" element={<EventMenusPage />} />
            <Route path="/event-menus/:id" element={<EventMenuDetailPage />} />
            <Route path="/shopping-lists" element={<ShoppingListsPage />} />
            <Route path="/shopping-lists/view" element={<ShoppingListDetailPage />} />
            <Route path="/shopping-lists/saved/:listId" element={<ShoppingListDetailPage />} />
            <Route path="/comparison" element={<SupervisorComparisonPage />} />
            <Route path="/transfers" element={<TransfersPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/kitchens" element={<KitchensPage />} />
            <Route path="/kitchens/:id" element={<KitchenDetailPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/analysis" element={<AIAnalysisPage />} />
            <Route path="/estatisticas" element={<EstatisticasPage />} />
            <Route path="/supervisor/producao" element={<SupervisorProducaoPage />} />
            <Route path="/holerites" element={<PayslipsAdminPage />} />
            <Route path="/meus-holerites" element={<MyPayslipsPage />} />
            <Route path="/meus-holerites/:id" element={<PayslipSignPage />} />
            <Route path="/users/:id" element={<EmployeeDetailPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/fornecedores" element={<FornecedoresPage />} />
            <Route path="/fornecedores/:supplierName" element={<FornecedorDetailPage />} />
            <Route path="/materiais" element={<MateriaisInventarioPage />} />
            <Route path="/materiais/categorias" element={<MateriaisCategoriasPage />} />
            <Route path="/materiais/emprestimos" element={<EmprestimosPage />} />
            <Route path="/materiais/lista-base" element={<ListaBasePage />} />
            <Route path="/materiais/perdas" element={<PerdasPage />} />
            <Route path="/invoices" element={<Navigate to="/entries" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </SupervisorRouteGuard>
        </Suspense>
        </ErrorBoundary>
      </SupervisorLayout>
    );
  }

  return (
    <EmployeeLayout>
      <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={permissions.access_stock ? <EmployeeDashboard /> : <Navigate to="/materiais" replace />} />
          <Route path="/inventario" element={permissions.access_stock ? <EmployeeInventoryPage /> : <Navigate to="/materiais" replace />} />
          <Route path="/eventos" element={permissions.access_stock ? <EmployeeEventsPage /> : <Navigate to="/materiais" replace />} />
          <Route path="/materiais" element={permissions.access_materials ? <EmployeeMateriaisPage /> : <Navigate to="/" replace />} />
          <Route path="/producao" element={<ProducaoPage />} />
          <Route path="/meus-holerites" element={<MyPayslipsPage />} />
          <Route path="/meus-holerites/:id" element={<PayslipSignPage />} />
          <Route path="*" element={<Navigate to={permissions.access_stock ? "/" : "/materiais"} replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </EmployeeLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/pub-inv" element={
            <Suspense fallback={<PageLoader />}><PublicInventoryPage /></Suspense>
          } />
          <Route path="/menu/:eventId" element={
            <Suspense fallback={<PageLoader />}><MenuSelectionPage /></Suspense>
          } />
          <Route path="/contrato-cliente/:token" element={
            <Suspense fallback={<PageLoader />}><ContractFormPage /></Suspense>
          } />
          <Route path="/*" element={
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
