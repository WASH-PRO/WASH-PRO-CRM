import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { BrandLogo } from '../components/BrandLogo';
import { setWelcomeSeen, getWelcomeSeen } from '../utils/setupStorage';
import { setupRoleHint } from '../utils/setupPermissions';

export function WelcomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user && getWelcomeSeen(user.id)) {
    return <Navigate to="/" replace />;
  }

  const finish = () => {
    if (user) setWelcomeSeen(user.id);
    navigate('/', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-panel-canvas dark:bg-panel-canvas-dark">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-lg rounded-2xl border border-panel-border bg-panel-surface p-8 shadow-panel dark:border-panel-border-dark dark:bg-panel-surface-dark">
          <div className="mb-6 flex items-center gap-3">
            <BrandLogo size="md" />
            <div>
              <div className="text-sm font-semibold text-panel-ink dark:text-white">WASH PRO CRM</div>
              <div className="text-xs text-panel-muted dark:text-slate-500">Добро пожаловать</div>
            </div>
          </div>

          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-400/10 dark:text-brand-400">
            <Sparkles size={24} />
          </div>

          <h1 className="font-display text-2xl font-semibold text-panel-ink dark:text-white">
            Здравствуйте, {user?.name || user?.login}!
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-panel-muted dark:text-panel-muted-dark">
            Система готова к работе. Ваш уровень доступа:{' '}
            <span className="font-medium text-panel-ink dark:text-panel-ink-dark">{setupRoleHint(user)}</span>.
            Используйте боковое меню для мониторинга постов, карт и финансов.
          </p>

          <ul className="mt-5 space-y-2 text-sm text-panel-muted dark:text-panel-muted-dark">
            <li>• Панель — сводка по объектам и постам</li>
            <li>• Посты — состояние оборудования и MQTT</li>
            <li>• Настройки — параметры системы (при наличии прав)</li>
          </ul>

          <button type="button" className="btn-primary mt-8 w-full" onClick={finish}>
            Перейти в систему
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
