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
import SupervisorComparisonPage from "./pages/supervisor/ComparisonPage";
import UsersPage from "./pages/supervisor/UsersPage";
import NotificationsPage from "./pages/supervisor/NotificationsPage";
import AIAnalysisPage from "./pages/supervisor/AIAnalysisPage";
import CategoriesPage from "./pages/supervisor/CategoriesPage";
import InventoryPage from "./pages/supervisor/InventoryPage";

import EmployeeLayout from "./components/EmployeeLayout";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, role, loading } = useAuth();

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
    return (
      <SupervisorLayout>
        <Routes>
          <Route path="/" element={<SupervisorDashboard />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/items" element={<StockItemsPage />} />
          <Route path="/entries" element={<EntriesPage />} />
          <Route path="/outputs" element={<SupervisorOutputsPage />} />
          <Route path="/sheets" element={<SupervisorSheetsPage />} />
          <Route path="/comparison" element={<SupervisorComparisonPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/analysis" element={<AIAnalysisPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SupervisorLayout>
    );
  }

  // Employee
  return (
    <EmployeeLayout>
      <Routes>
        <Route path="/" element={<EmployeeDashboard />} />
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
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
