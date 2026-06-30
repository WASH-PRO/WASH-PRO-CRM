import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';

function LoginField({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  autoFocus,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-panel-muted dark:text-panel-muted-dark">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          'block w-full rounded-lg border-0 px-3.5 py-2.5 text-sm',
          'bg-white text-panel-ink ring-1 ring-inset ring-panel-border placeholder:text-panel-muted',
          'outline-none transition-shadow focus:ring-2 focus:ring-inset focus:ring-brand-400/50',
          'dark:bg-[#0d1218] dark:text-panel-ink-dark dark:ring-panel-border-dark dark:placeholder:text-panel-muted-dark'
        )}
      />
    </div>
  );
}

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(loginName, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Левая половина — брендинг (макет как PyOrchestrator, свой фон) */}
      <div className="relative hidden min-h-[280px] overflow-hidden lg:flex lg:min-h-screen lg:flex-col lg:justify-between">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/login-background.svg)' }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-zinc-950/50" aria-hidden />
        <div
          className="absolute inset-0 bg-[linear-gradient(135deg,rgb(8_15_24/0.55)_0%,transparent_42%,rgb(8_145_178/0.14)_100%)]"
          aria-hidden
        />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-12 xl:p-16">
          <div>
            <div className="mb-16 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-brand-400/15 ring-1 ring-brand-400/30">
                <span className="text-sm font-extrabold text-brand-400">W</span>
              </div>
              <span className="text-lg font-bold text-white">WASH PRO CRM</span>
            </div>
            <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
              Управление автомойками в реальном времени
            </h2>
            <p className="mt-6 max-w-lg text-sm leading-relaxed text-zinc-300/90">
              SCADA, карты клиентов, финансовая аналитика и мониторинг постов — единая панель для операторов и
              администраторов.
            </p>
          </div>
          <p className="text-xs text-zinc-400">WASH PRO CRM · Enterprise SCADA</p>
        </div>
      </div>

      {/* Правая половина — форма входа */}
      <div className="relative flex min-h-screen flex-col justify-center bg-panel-canvas px-6 py-12 dark:bg-panel-canvas-dark sm:px-12 lg:px-16 xl:px-24">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>

        <div className="mx-auto w-full max-w-md animate-slide-up">
          <div className="mb-8 lg:mb-10">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <div className="flex size-10 items-center justify-center rounded-xl bg-brand-400/15 ring-1 ring-brand-400/30">
                <span className="text-xs font-extrabold text-brand-400">W</span>
              </div>
              <div>
                <p className="text-base font-bold text-panel-ink dark:text-panel-ink-dark">WASH PRO CRM</p>
                <p className="text-xs text-panel-muted dark:text-panel-muted-dark">Enterprise SCADA</p>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-panel-ink dark:text-panel-ink-dark">Вход в систему</h1>
            <p className="mt-2 text-sm text-panel-muted dark:text-panel-muted-dark">
              Введите учётные данные для доступа к панели управления
            </p>
          </div>

          {error ? (
            <div className="mb-6 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 ring-1 ring-inset ring-red-500/20 dark:text-red-400">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <LoginField
              id="login"
              label="Логин"
              type="text"
              value={loginName}
              onChange={setLoginName}
              autoComplete="username"
              autoFocus
            />
            <LoginField
              id="password"
              label="Пароль"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            <button
              type="submit"
              disabled={submitting}
              className={clsx(
                'mt-2 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white',
                'transition-colors hover:bg-brand-400',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400',
                'disabled:cursor-not-allowed disabled:opacity-60'
              )}
            >
              {submitting ? 'Вход…' : 'Войти в панель'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-panel-muted dark:text-panel-muted-dark lg:text-left">
            Доступ только для авторизованных сотрудников
          </p>
        </div>
      </div>
    </div>
  );
}
