import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ErrorMessage } from '../components/UI';

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-brand-50 p-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white">W</div>
          <h1 className="text-2xl font-bold">WASH PRO CRM</h1>
          <p className="mt-2 text-sm text-slate-500">Система управления автомойками</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && <ErrorMessage message={error} />}
          <div>
            <label className="label">Логин</label>
            <input className="input" value={loginName} onChange={(e) => setLoginName(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Пароль</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Вход...' : 'Войти'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button onClick={toggleTheme} className="text-sm text-slate-500 hover:text-brand-600">
            {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          </button>
        </div>
      </div>
    </div>
  );
}
