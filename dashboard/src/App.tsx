import { Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';
import { SetupGuard } from './components/SetupGuard';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { Loading } from './components/UI';
import { LoginPage } from './pages/LoginPage';
import { lazyPage } from './utils/lazyPage';

const DashboardPage = lazyPage(() => import('./pages/DashboardPage'), 'DashboardPage');
const WashesPage = lazyPage(() => import('./pages/WashesPage'), 'WashesPage');
const PostsPage = lazyPage(() => import('./pages/PostsPage'), 'PostsPage');
const PostDetailPage = lazyPage(() => import('./pages/PostDetailPage'), 'PostDetailPage');
const StatesPage = lazyPage(() => import('./pages/StatesPage'), 'StatesPage');
const UsagePage = lazyPage(() => import('./pages/UsagePage'), 'UsagePage');
const FinancePage = lazyPage(() => import('./pages/FinancePage'), 'FinancePage');
const ArchivePage = lazyPage(() => import('./pages/ArchivePage'), 'ArchivePage');
const BackupsPage = lazyPage(() => import('./pages/BackupsPage'), 'BackupsPage');
const TelegramPage = lazyPage(() => import('./pages/TelegramPage'), 'TelegramPage');
const McpPage = lazyPage(() => import('./pages/McpPage'), 'McpPage');
const InfoMessagesPage = lazyPage(() => import('./pages/InfoMessagesPage'), 'InfoMessagesPage');
const NotificationsPage = lazyPage(() => import('./pages/NotificationsPage'), 'NotificationsPage');
const CurrencyPage = lazyPage(() => import('./pages/CurrencyPage'), 'CurrencyPage');
const DiscountTypesPage = lazyPage(() => import('./pages/DiscountTypesPage'), 'DiscountTypesPage');
const WorkModesPage = lazyPage(() => import('./pages/WorkModesPage'), 'WorkModesPage');
const LogsPage = lazyPage(() => import('./pages/LogsPage'), 'LogsPage');
const MqttPage = lazyPage(() => import('./pages/MqttPage'), 'MqttPage');
const UsersPage = lazyPage(() => import('./pages/UsersPage'), 'UsersPage');
const GroupsPage = lazyPage(() => import('./pages/GroupsPage'), 'GroupsPage');
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'), 'SettingsPage');
const ProfilePage = lazyPage(() => import('./pages/ProfilePage'), 'ProfilePage');
const SetupWizardPage = lazyPage(() => import('./pages/SetupWizardPage'), 'SetupWizardPage');
const WelcomePage = lazyPage(() => import('./pages/WelcomePage'), 'WelcomePage');

const CardsLayout = lazyPage(() => import('./pages/CardsPage'), 'CardsLayout');
const CardsDiscountPage = lazyPage(() => import('./pages/CardsPage'), 'CardsDiscountPage');
const CardsServicePage = lazyPage(() => import('./pages/CardsPage'), 'CardsServicePage');
const CardsVipPage = lazyPage(() => import('./pages/CardsPage'), 'CardsVipPage');
const CardsCollectionPage = lazyPage(() => import('./pages/CardsPage'), 'CardsCollectionPage');

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/setup"
        element={
          <ProtectedRoute>
            <SetupWizardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/welcome"
        element={
          <ProtectedRoute>
            <WelcomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <SetupGuard>
              <Layout />
            </SetupGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="washes" element={<WashesPage />} />
        <Route path="posts" element={<PostsPage />} />
        <Route path="posts/:postId" element={<PostDetailPage />} />
        <Route path="states" element={<StatesPage />} />
        <Route path="mqtt" element={<MqttPage />} />
        <Route path="cards" element={<CardsLayout />}>
          <Route index element={<Navigate to="discount" replace />} />
          <Route path="discount" element={<CardsDiscountPage />} />
          <Route path="service" element={<CardsServicePage />} />
          <Route path="vip" element={<CardsVipPage />} />
          <Route path="collection" element={<CardsCollectionPage />} />
        </Route>
        <Route path="usage" element={<UsagePage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="archive" element={<ArchivePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
        <Route path="groups" element={<AdminRoute><GroupsPage /></AdminRoute>} />
        <Route path="backups" element={<AdminRoute><BackupsPage /></AdminRoute>} />
        <Route path="telegram" element={<AdminRoute><TelegramPage /></AdminRoute>} />
        <Route path="mcp" element={<AdminRoute><McpPage /></AdminRoute>} />
        <Route path="info-messages" element={<AdminRoute><InfoMessagesPage /></AdminRoute>} />
        <Route path="work-modes" element={<AdminRoute><WorkModesPage /></AdminRoute>} />
        <Route path="currency" element={<AdminRoute><CurrencyPage /></AdminRoute>} />
        <Route path="discount-types" element={<AdminRoute><DiscountTypesPage /></AdminRoute>} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
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
          <RouteErrorBoundary>
            <Suspense fallback={<Loading fullScreen />}>
              <AppRoutes />
            </Suspense>
          </RouteErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
