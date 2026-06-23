import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: doLogin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await doLogin(login, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-brand-50 p-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
            <Zap className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">Dynamic API Platform</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to manage your dynamic APIs</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && <div className="alert-error">{error}</div>}

          <div>
            <label className="label">Login</label>
            <input
              type="text"
              className="input"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="admin"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="text-center text-xs text-slate-500">
            Default: admin / Admin123!
          </p>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={toggleTheme}
            className="text-sm text-slate-500 hover:text-brand-600 dark:hover:text-brand-300"
          >
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </button>
        </div>
      </div>
    </div>
  );
}
