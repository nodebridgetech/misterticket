import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import Index from "./pages/Index";
import EventDetails from "./pages/EventDetails";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Events from "./pages/Events";
import MyAccount from "./pages/MyAccount";
import ProducerDashboard from "./pages/ProducerDashboard";
import MyEvents from "./pages/MyEvents";
import AdminDashboard from "./pages/AdminDashboard";
import ProducersManagement from "./pages/ProducersManagement";
import EventsManagement from "./pages/EventsManagement";
import ActivityLogs from "./pages/ActivityLogs";
import CreateEvent from "./pages/CreateEvent";
import EditEvent from "./pages/EditEvent";
import Checkout from "./pages/Checkout";
import PaymentSuccess from "./pages/PaymentSuccess";
import ValidateTickets from "./pages/ValidateTickets";
import NotFound from "./pages/NotFound";
import EventAnalytics from "./pages/EventAnalytics";
import SiteSettingsManagement from "./pages/SiteSettingsManagement";
import UtmLinks from "./pages/UtmLinks";
import UtmAnalytics from "./pages/UtmAnalytics";
import WithdrawalRequests from "./pages/WithdrawalRequests";
import AdminWithdrawals from "./pages/AdminWithdrawals";
import FinancialDashboard from "./pages/FinancialDashboard";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Sonner />
      <PWAUpdatePrompt />
      <BrowserRouter>
        <AuthProvider>
          <AppLayout>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/eventos" element={<Events />} />
            <Route path="/event/:id" element={<EventDetails />} />
            <Route path="/checkout/:id" element={<Checkout />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/esqueci-senha" element={<ForgotPassword />} />
          <Route path="/redefinir-senha" element={<ResetPassword />} />
            <Route path="/minha-conta" element={<MyAccount />} />
            <Route path="/painel" element={<ProducerDashboard />} />
            <Route path="/meus-eventos" element={<MyEvents />} />
            <Route path="/criar-evento" element={<CreateEvent />} />
            <Route path="/editar-evento/:id" element={<EditEvent />} />
            <Route path="/event-analytics/:id" element={<EventAnalytics />} />
            <Route path="/links-utm" element={<UtmLinks />} />
            <Route path="/utm-analytics/:id" element={<UtmAnalytics />} />
            <Route path="/saques" element={<WithdrawalRequests />} />
            <Route path="/financeiro" element={<FinancialDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/produtores" element={<ProducersManagement />} />
            <Route path="/admin/eventos" element={<EventsManagement />} />
            <Route path="/admin/saques" element={<AdminWithdrawals />} />
            <Route path="/admin/logs" element={<ActivityLogs />} />
            <Route path="/admin/configuracoes" element={<SiteSettingsManagement />} />
            <Route path="/validar-ingressos" element={<ValidateTickets />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
