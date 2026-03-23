import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

import LoginPage from "./pages/auth/LoginPage";
import NoRolePage from "./pages/auth/NoRolePage";

import SupervisorLayout from "./components/SupervisorLayout";
import SupervisorDashboard from "./pages/supervisor/SupervisorDashboard";
import StockItemsPage from "./pages/supervisor/StockItemsPage";
import EntriesPage from "./pages/supervisor/EntriesPage";
import SupervisorOutputsPage from "./pages/supervisor/OutputsPage";
import SupervisorSheetsPage from "./pages/supervisor/SheetsPage";
import SheetDetailPage from "./pages/supervisor/SheetDetailPage";
import SupervisorComparisonPage from "./pages/supervisor/ComparisonPage";
import UsersPage from "./pages/supervisor/UsersPage";
import NotificationsPage from "./pages/supervisor/NotificationsPage";
import AIAnalysisPage from "./pages/supervisor/AIAnalysisPage";
import CategoriesPage from "./pages/supervisor/CategoriesPage";
import CategoryDetailPage from "./pages/supervisor/CategoryDetailPage";
import StockItemDetailPage from "./pages/supervisor/StockItemDetailPage";
import InventoryPage from "./pages/supervisor/InventoryPage";
import KitchensPage from "./pages/supervisor/KitchensPage";
import KitchenDetailPage from "./pages/supervisor/KitchenDetailPage";
import TransfersPage from "./pages/supervisor/TransfersPage";
import EventMenusPage from "./pages/supervisor/EventMenusPage";
import EventMenuDetailPage from "./pages/supervisor/EventMenuDetailPage";
import FornecedoresPage from "./pages/supervisor/FornecedoresPage";
import FornecedorDetailPage from "./pages/supervisor/FornecedorDetailPage";
import ShoppingListsPage from "./pages/supervisor/ShoppingListsPage";
import ShoppingListDetailPage from "./pages/supervisor/ShoppingListDetailPage";
import MobileSupervisorApp from "./pages/supervisor/MobileSupervisorApp";
import MateriaisInventarioPage from "./pages/supervisor/materiais/MateriaisInventarioPage";
import EmprestimosPage from "./pages/supervisor/materiais/EmprestimosPage";

import EmployeeLayout from "./components/EmployeeLayout";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import EmployeeInventoryPage from "./pages/employee/EmployeeInventoryPage";
import EmployeeEventsPage from "./pages/employee/EmployeeEventsPage";

import PublicInventoryPage from "./pages/public/PublicInventoryPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
  const { user, role, loading } = useAuth();
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
    if (isMobile) return <MobileSupervisorApp />;
    return (
      <SupervisorLayout>
        <Routes>
          <Route path="/" element={<SupervisorDashboard />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/categories/:name" element={<CategoryDetailPage />} />
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
          <Route path="/materiais/emprestimos" element={<EmprestimosPage />} />
          <Route path="/invoices" element={<Navigate to="/entries" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SupervisorLayout>
    );
  }

  return (
    <EmployeeLayout>
      <Routes>
        <Route path="/" element={<EmployeeDashboard />} />
        <Route path="/inventario" element={<EmployeeInventoryPage />} />
        <Route path="/eventos" element={<EmployeeEventsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
          <Route path="/pub-inv" element={<PublicInventoryPage />} />
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
