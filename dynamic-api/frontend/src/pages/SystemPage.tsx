import { useEffect, useState, useMemo } from 'react';
import {
  Server, Cpu, HardDrive, MemoryStick, FolderOpen, Network,
  Clock, Monitor, RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { SystemInfo } from '../types';
import { formatBytes, formatUptime } from '../utils/format';
import { matchesSearch } from '../utils/search';
import { PageHeader, LoadingSpinner, SearchInput } from '../components/UI';

function InfoCard({ icon: Icon, label, value, sub, color = '#3b82f6' }: {
  icon: typeof Server; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="info-card">
      <div className="flex items-start justify-between mb-3">
        <div className="info-card-icon" style={{ backgroundColor: `${color}18`, color }}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-xs text-dark-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {sub && <p className="text-xs text-dark-muted mt-1">{sub}</p>}
    </div>
  );
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function SystemPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkSearch, setNetworkSearch] = useState('');

  const load = () => {
    setLoading(true);
    api.getSystemInfo()
      .then(setInfo)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filteredInterfaces = useMemo(() => {
    if (!info) return [];
    return info.network.interfaces.filter((iface) =>
      matchesSearch(networkSearch, iface.name, iface.address, iface.family)
    );
  }, [info, networkSearch]);

  if (loading) return <LoadingSpinner />;
  if (!info) return <div className="text-center text-dark-muted py-12">Failed to load system info</div>;

  return (
    <div>
      <PageHeader
        title="System"
        subtitle="Server resources and environment information"
        action={
          <button className="btn-secondary" onClick={load}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <InfoCard icon={Monitor} label="Operating System" value={info.osType} sub={info.osRelease} color="#8b5cf6" />
        <InfoCard icon={Cpu} label="Processor" value={`${info.cpuCores} cores`} sub={info.cpuModel} color="#f59e0b" />
        <InfoCard icon={Server} label="Hostname" value={info.hostname} sub={info.architecture} color="#3b82f6" />
        <InfoCard icon={Clock} label="Uptime" value={formatUptime(info.uptime)} sub={`Node ${info.nodeVersion}`} color="#10b981" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MemoryStick className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-sm">Memory</h3>
            <span className="ml-auto text-sm font-medium">{info.memoryUsagePercent}%</span>
          </div>
          <ProgressBar percent={info.memoryUsagePercent} color="#3b82f6" />
          <div className="grid grid-cols-3 gap-4 mt-4 text-center">
            <div>
              <p className="text-xs text-dark-muted">Total</p>
              <p className="text-sm font-medium">{formatBytes(info.totalMemory)}</p>
            </div>
            <div>
              <p className="text-xs text-dark-muted">Used</p>
              <p className="text-sm font-medium text-yellow-400">{formatBytes(info.usedMemory)}</p>
            </div>
            <div>
              <p className="text-xs text-dark-muted">Free</p>
              <p className="text-sm font-medium text-green-400">{formatBytes(info.freeMemory)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="w-4 h-4 text-purple-400" />
            <h3 className="font-semibold text-sm">Disk Space</h3>
            <span className="ml-auto text-sm font-medium">{info.disk.usagePercent}%</span>
          </div>
          <ProgressBar percent={info.disk.usagePercent} color="#8b5cf6" />
          <div className="grid grid-cols-3 gap-4 mt-4 text-center">
            <div>
              <p className="text-xs text-dark-muted">Total</p>
              <p className="text-sm font-medium">{formatBytes(info.disk.total)}</p>
            </div>
            <div>
              <p className="text-xs text-dark-muted">Used</p>
              <p className="text-sm font-medium text-yellow-400">{formatBytes(info.disk.used)}</p>
            </div>
            <div>
              <p className="text-xs text-dark-muted">Free</p>
              <p className="text-sm font-medium text-green-400">{formatBytes(info.disk.free)}</p>
            </div>
          </div>
          <p className="text-xs text-dark-muted mt-3">Mount: {info.disk.mount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-4 h-4 text-green-400" />
            <h3 className="font-semibold text-sm">Files</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-dark-border/50">
              <span className="text-sm text-dark-muted">Application files</span>
              <span className="font-medium">{info.files.appFiles}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-dark-border/50">
              <span className="text-sm text-dark-muted">Log files</span>
              <span className="font-medium">{info.files.logFiles}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-dark-muted">Total project files</span>
              <span className="font-semibold text-primary-400">{info.files.totalProjectFiles}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4 text-orange-400" />
            <h3 className="font-semibold text-sm">CPU Details</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-dark-muted">Model</span><span className="text-right max-w-[60%] truncate">{info.cpuModel}</span></div>
            <div className="flex justify-between"><span className="text-dark-muted">Cores</span><span>{info.cpuCores}</span></div>
            <div className="flex justify-between"><span className="text-dark-muted">Speed</span><span>{info.cpuSpeed} MHz</span></div>
            <div className="flex justify-between"><span className="text-dark-muted">Load avg</span><span>{info.loadAverage.map((l) => l.toFixed(2)).join(' / ')}</span></div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-sm">Application</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-dark-muted">Name</span><span>{info.appName}</span></div>
            <div className="flex justify-between"><span className="text-dark-muted">Version</span><span className="badge-blue">{info.appVersion}</span></div>
            <div className="flex justify-between"><span className="text-dark-muted">Environment</span><span className="badge-yellow">{info.environment}</span></div>
            <div className="flex justify-between"><span className="text-dark-muted">Platform</span><span>{info.platform}</span></div>
          </div>
        </div>
      </div>

      {info.network.interfaces.length > 0 && (
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-sm">Network Interfaces</h3>
            </div>
            <SearchInput
              className="sm:w-72"
              value={networkSearch}
              onChange={setNetworkSearch}
              placeholder="Search interfaces..."
            />
          </div>
          {filteredInterfaces.length === 0 ? (
            <p className="text-sm text-dark-muted text-center py-6">No interfaces match your search</p>
          ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Interface</th><th>Address</th><th>Family</th></tr>
              </thead>
              <tbody>
                {filteredInterfaces.map((iface, i) => (
                  <tr key={i}>
                    <td className="font-medium">{iface.name}</td>
                    <td className="font-mono text-xs">{iface.address}</td>
                    <td><span className="badge-purple">{iface.family}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
