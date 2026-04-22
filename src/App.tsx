import { lazy, Suspense, useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// ─── Layouts (carregam cedo, são pequenos) ───
import SupervisorLayout from "./components/SupervisorLayout";
import EmployeeLayout from "./components/EmployeeLayout";

// ─── Auth (sempre necessários na primeira tela) ───
import LoginPage from "./pages/auth/LoginPage";
import NoRolePage from "./pages/auth/NoRolePage";

// ─── Supervisor pages (lazy) ───
const SupervisorDashboard      = lazy(() => import("./pages/supervisor/SupervisorDashboard"));
const StockItemsPage           = lazy(() => import("./pages/supervisor/StockItemsPage"));
const EntriesPage              = lazy(() => import("./pages/supervisor/EntriesPage"));
const SupervisorOutputsPage    = lazy(() => import("./pages/supervisor/OutputsPage"));
const SupervisorSheetsPage     = lazy(() => import("./pages/supervisor/SheetsPage"));
const SheetDetailPage          = lazy(() => import("./pages/supervisor/SheetDetailPage"));
const SupervisorComparisonPage = lazy(() => import("./pages/supervisor/ComparisonPage"));
const UsersPage                = lazy(() => import("./pages/supervisor/UsersPage"));
const NotificationsPage        = lazy(() => import("./pages/supervisor/NotificationsPage"));
const AIAnalysisPage           = lazy(() => import("./pages/supervisor/AIAnalysisPage"));
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

// ─── Public pages (lazy) ───
const PublicInventoryPage = lazy(() => import("./pages/public/PublicInventoryPage"));
const MenuSelectionPage   = lazy(() => import("./pages/public/MenuSelectionPage"));

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

  if (!user) return <LoginPage />;
  if (!role) return <NoRolePage />;

  if (role === 'supervisor') {
    if (isMobile) {
      return (
        <Suspense fallback={<PageLoader />}>
          <MobileSupervisorApp />
        </Suspense>
      );
    }
    return (
      <SupervisorLayout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<SupervisorDashboard />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/categories/:name" element={<CategoryDetailPage />} />
            <Route path="/tags" element={<TagsPage />} />
            <Route path="/items" element={<StockItemsPage />} />
            <Route path="/items/:id" element={<StockItemDetailPage />} />
            <Route path="/entries" element={<EntriesPage />} />
            <Route path="/outputs" element={<SupervisorOutputsPage />} />
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
        </Suspense>
      </SupervisorLayout>
    );
  }

  return (
    <EmployeeLayout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={permissions.access_stock ? <EmployeeDashboard /> : <Navigate to="/materiais" replace />} />
          <Route path="/inventario" element={permissions.access_stock ? <EmployeeInventoryPage /> : <Navigate to="/materiais" replace />} />
          <Route path="/eventos" element={permissions.access_stock ? <EmployeeEventsPage /> : <Navigate to="/materiais" replace />} />
          <Route path="/materiais" element={permissions.access_materials ? <EmployeeMateriaisPage /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to={permissions.access_stock ? "/" : "/materiais"} replace />} />
        </Routes>
      </Suspense>
    </EmployeeLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/pub-inv" element={
            <Suspense fallback={<PageLoader />}><PublicInventoryPage /></Suspense>
          } />
          <Route path="/menu/:eventId" element={
            <Suspense fallback={<PageLoader />}><MenuSelectionPage /></Suspense>
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
