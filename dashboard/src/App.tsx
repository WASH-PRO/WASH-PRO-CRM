import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';
import { Loading } from './components/UI';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { WashesPage } from './pages/WashesPage';
import { PostsPage } from './pages/PostsPage';
import { StatesPage } from './pages/StatesPage';
import {
  CardsLayout,
  CardsDiscountPage,
  CardsServicePage,
  CardsVipPage,
} from './pages/CardsPage';
import { UsagePage } from './pages/UsagePage';
import { FinancePage } from './pages/FinancePage';
import { ArchivePage } from './pages/ArchivePage';
import { BackupsPage } from './pages/BackupsPage';
import { TelegramPage } from './pages/TelegramPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { CurrencyPage } from './pages/CurrencyPage';
import { DiscountTypesPage } from './pages/DiscountTypesPage';
import { LogsPage } from './pages/LogsPage';
import { UsersPage } from './pages/UsersPage';
import { GroupsPage } from './pages/GroupsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="washes" element={<WashesPage />} />
        <Route path="posts" element={<PostsPage />} />
        <Route path="states" element={<StatesPage />} />
        <Route path="cards" element={<CardsLayout />}>
          <Route index element={<Navigate to="discount" replace />} />
          <Route path="discount" element={<CardsDiscountPage />} />
          <Route path="service" element={<CardsServicePage />} />
          <Route path="vip" element={<CardsVipPage />} />
        </Route>
        <Route path="usage" element={<UsagePage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="archive" element={<ArchivePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
        <Route path="groups" element={<AdminRoute><GroupsPage /></AdminRoute>} />
        <Route path="backups" element={<AdminRoute><BackupsPage /></AdminRoute>} />
        <Route path="telegram" element={<AdminRoute><TelegramPage /></AdminRoute>} />
        <Route path="currency" element={<AdminRoute><CurrencyPage /></AdminRoute>} />
        <Route path="discount-types" element={<AdminRoute><DiscountTypesPage /></AdminRoute>} />
        <Route path="logs" element={<AdminRoute><LogsPage /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
