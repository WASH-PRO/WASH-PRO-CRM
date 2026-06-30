import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useTranslation } from "./context/LocaleContext";
import { RefreshModeProvider } from "./context/RefreshModeContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LocaleProvider } from "./context/LocaleContext";
import { ToastProvider } from "./context/ToastContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ScriptsPage from "./pages/Scripts";
import ScriptEditorPage from "./pages/ScriptEditor";
import GroupsPage from "./pages/Groups";
import SchedulesPage from "./pages/Schedules";
import WebhooksPage from "./pages/Webhooks";
import NotificationsPage from "./pages/Notifications";
import BackupsPage from "./pages/Backups";
import SettingsPage from "./pages/Settings";
import SystemPage from "./pages/System";
import McpPage from "./pages/Mcp";
import UsersPage from "./pages/Users";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-faint">
        {t("common.loading")}
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <LocaleProvider>
      <ToastProvider>
      <ThemeProvider>
        <AuthProvider>
          <RefreshModeProvider>
            <BrowserRouter>
          <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/scripts" element={<ScriptsPage />} />
            <Route path="/scripts/:id" element={<ScriptEditorPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/schedules" element={<SchedulesPage />} />
            <Route path="/webhooks" element={<WebhooksPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/backups" element={<BackupsPage />} />
            <Route path="/system" element={<SystemPage />} />
            <Route path="/mcp" element={<McpPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
          </BrowserRouter>
        </RefreshModeProvider>
      </AuthProvider>
    </ThemeProvider>
      </ToastProvider>
    </LocaleProvider>
  );
}
