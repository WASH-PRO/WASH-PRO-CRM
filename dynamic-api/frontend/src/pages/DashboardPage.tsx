import { useEffect, useState } from 'react';
import { Users, Globe, Activity, AlertTriangle, Shield } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';
import { DashboardStats } from '../types';
import { StatCard, PageHeader, LoadingSpinner } from '../components/UI';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboardStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!stats) return <div className="text-center text-dark-muted">Failed to load dashboard</div>;

  const chartData = stats.requestsOverTime.map((r, i) => ({
    date: r.date.slice(5),
    requests: r.count,
    errors: stats.errorsOverTime[i]?.count || 0,
    activity: stats.userActivity[i]?.count || 0,
  }));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="System overview and statistics" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <StatCard title="Users" value={stats.users} icon={Users} color="#3b82f6" subtitle={`${stats.activeUsers} active`} />
        <StatCard title="Endpoints" value={stats.endpoints} icon={Globe} color="#8b5cf6" />
        <StatCard title="Requests" value={stats.requests} icon={Activity} color="#10b981" />
        <StatCard title="Errors" value={stats.errors} icon={AlertTriangle} color="#ef4444" />
        <StatCard title="Groups" value={stats.groups} icon={Shield} color="#f59e0b" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold mb-4 text-sm">Requests Over Time</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1a1f2e', border: '1px solid #2a3142', borderRadius: 8, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="requests" stroke="#3b82f6" fill="#3b82f620" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4 text-sm">Errors Over Time</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1a1f2e', border: '1px solid #2a3142', borderRadius: 8, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="#ef444420" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="font-semibold mb-4 text-sm">User Activity</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1a1f2e', border: '1px solid #2a3142', borderRadius: 8, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="activity" stroke="#8b5cf6" fill="#8b5cf620" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
