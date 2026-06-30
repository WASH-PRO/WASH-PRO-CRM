import { Activity } from 'lucide-react';

const endpoints = [
  { method: 'GET', path: '/api/products', status: '200', tone: 'get' },
  { method: 'POST', path: '/api/orders', status: '201', tone: 'post' },
  { method: 'PUT', path: '/api/users/:id', status: '200', tone: 'put' },
] as const;

export default function LoginVisualPanel() {
  return (
    <div className="login-visual-root">
      <div className="login-visual-mesh" aria-hidden />
      <div className="login-visual-orb login-visual-orb-a" aria-hidden />
      <div className="login-visual-orb login-visual-orb-b" aria-hidden />

      <div className="login-visual-inner">
        <div className="login-visual-brand">
          <h2 className="login-visual-brand-title">Dynamic API Platform</h2>
          <p className="login-visual-brand-subtitle">
            REST endpoints, schemas, and access control in one place
          </p>
        </div>

        <div className="login-preview-card">
          <div className="login-preview-header">
            <span className="login-preview-label">Live endpoints</span>
            <span className="login-preview-pill">
              <Activity className="h-3.5 w-3.5" />
              Live
            </span>
          </div>

          <ul className="login-preview-list">
            {endpoints.map((item) => (
              <li key={item.path} className="login-preview-row">
                <span className={`login-preview-method login-preview-method-${item.tone}`}>
                  {item.method}
                </span>
                <span className="login-preview-path">{item.path}</span>
                <span className="login-preview-status">{item.status}</span>
              </li>
            ))}
          </ul>

          <div className="login-preview-metrics">
            <div>
              <p className="login-preview-metric-label">Requests today</p>
              <p className="login-preview-metric-value">12,458</p>
            </div>
            <div>
              <p className="login-preview-metric-label">Avg response</p>
              <p className="login-preview-metric-value">120 ms</p>
            </div>
          </div>

          <svg className="login-preview-chart" viewBox="0 0 360 64" aria-hidden>
            <defs>
              <linearGradient id="login-chart-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,48 C40,44 80,36 120,38 C160,40 200,24 240,28 C280,32 320,18 360,22 L360,64 L0,64 Z"
              fill="url(#login-chart-fill)"
            />
            <path
              d="M0,48 C40,44 80,36 120,38 C160,40 200,24 240,28 C280,32 320,18 360,22"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
