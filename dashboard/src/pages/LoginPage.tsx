import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { BrandLogo } from '../components/BrandLogo';
import { useLocale } from '../i18n/LocaleContext';
import { useBranding } from '../context/BrandingContext';

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
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      />
    </div>
  );
}

export function LoginPage() {
  const { t } = useLocale();
  const { branding } = useBranding();
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
      setError(err instanceof Error ? err.message : t('errors.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-2">
      {/* Левая половина — брендинг (макет как PyOrchestrator, свой фон) */}
      <div className="relative hidden min-h-[280px] overflow-hidden lg:flex lg:min-h-screen lg:flex-col lg:justify-between">
        <div className="login-bg-animated absolute inset-0" aria-hidden>
          <div
            className="login-bg-pan absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: 'url(/login-background.svg)' }}
          />
          <div className="login-bg-shimmer absolute inset-0" aria-hidden />
          <div className="login-bg-bubbles pointer-events-none absolute inset-0" aria-hidden>
            <span className="login-bubble login-bubble-1" />
            <span className="login-bubble login-bubble-2" />
            <span className="login-bubble login-bubble-3" />
            <span className="login-bubble login-bubble-4" />
            <span className="login-bubble login-bubble-5" />
          </div>
        </div>
        <div className="absolute inset-0 bg-sky-950/35" aria-hidden />
        <div
          className="absolute inset-0 bg-[linear-gradient(135deg,rgb(8_47_73/0.4)_0%,transparent_48%,rgb(34_211_238/0.1)_100%)]"
          aria-hidden
        />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-12 xl:p-16">
          <div>
            <div className="mb-16 flex items-center gap-3">
              <BrandLogo size="lg" tone="onDark" imageUrl={branding.logoUrl || undefined} />
              <span className="text-lg font-bold text-white">{branding.productName}</span>
            </div>
            <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
              {t('pages.login.heroTitle')}
            </h2>
            <p className="mt-6 max-w-lg text-sm leading-relaxed text-zinc-300/90">
              {t('pages.login.heroSubtitle')}
            </p>
          </div>
          <p className="text-xs text-zinc-400">{branding.productName} · {branding.tagline}</p>
        </div>
      </div>

      {/* Правая половина — форма входа */}
      <div className="relative flex min-h-[100dvh] flex-col justify-center bg-panel-canvas px-6 py-12 dark:bg-panel-canvas-dark sm:px-12 lg:min-h-screen lg:px-16 xl:px-24">
        <div className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))]">
          <ThemeToggle />
        </div>

        <div className="mx-auto w-full max-w-md animate-slide-up">
          <div className="mb-8 lg:mb-10">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <BrandLogo size="md" tone="onLight" imageUrl={branding.logoUrl || undefined} />
              <div>
                <p className="text-base font-bold text-panel-ink dark:text-panel-ink-dark">{branding.productName}</p>
                <p className="text-xs text-panel-muted dark:text-panel-muted-dark">{branding.tagline}</p>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-panel-ink dark:text-panel-ink-dark">{t('pages.login.title')}</h1>
            <p className="mt-2 text-sm text-panel-muted dark:text-panel-muted-dark">
              {t('pages.login.subtitle')}
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
              label={t('pages.login.login')}
              type="text"
              value={loginName}
              onChange={setLoginName}
              autoComplete="username"
              autoFocus
            />
            <LoginField
              id="password"
              label={t('pages.login.password')}
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
              {submitting ? t('pages.login.submitting') : t('pages.login.submit')}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-panel-muted dark:text-panel-muted-dark lg:text-left">
            {t('pages.login.accessOnly')}
          </p>
        </div>
      </div>
    </div>
  );
}
