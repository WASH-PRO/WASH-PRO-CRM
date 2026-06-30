import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, BookOpen, Github, Palette } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getThemeOption } from '../themes';
import LoginVisualPanel from '../components/LoginVisualPanel';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: doLogin } = useAuth();
  const { theme, cycleTheme } = useTheme();
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
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      <section className="login-panel-visual relative hidden min-h-screen w-full overflow-hidden lg:block lg:w-[52%]" aria-hidden>
        <LoginVisualPanel />
      </section>

      <section className="login-panel-form flex min-h-screen w-full flex-col justify-center px-6 py-12 sm:px-10 lg:w-[48%] lg:px-12 xl:px-16">
        <div className="login-mobile-brand mb-8 lg:hidden">
          <p className="text-lg font-semibold text-slate-900">Welcome back</p>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage your dynamic APIs</p>
        </div>

        <div className="mx-auto w-full max-w-[26rem]">
          <div className="mb-8 hidden lg:block">
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-500">
              Sign in to manage your dynamic APIs
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form space-y-5">
            {error && <div className="alert-error">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="login-field-label" htmlFor="login">Login</label>
                <input
                  id="login"
                  type="text"
                  className="login-field"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="admin"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="login-field-label" htmlFor="password">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="login-field pr-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <p className="text-center text-xs text-slate-400">
              Default credentials: <span className="font-medium text-slate-500">admin</span> / <span className="font-medium text-slate-500">Admin123!</span>
            </p>
          </form>

          <div className="login-footer">
            <button type="button" onClick={cycleTheme} className="login-footer-link">
              <Palette className="h-4 w-4" />
              {getThemeOption(theme)?.label ?? theme}
            </button>
            <a
              href="https://dynamic-api-platform.github.io/Dynamic-API-Platform/"
              target="_blank"
              rel="noopener noreferrer"
              className="login-footer-link"
            >
              <BookOpen className="h-4 w-4" />
              Documentation
            </a>
            <a
              href="https://github.com/Dynamic-API-Platform"
              target="_blank"
              rel="noopener noreferrer"
              className="login-footer-link"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
