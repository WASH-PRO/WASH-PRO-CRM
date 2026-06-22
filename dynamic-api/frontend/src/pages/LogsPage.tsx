import { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { LogEntry } from '../types';
import { PageHeader, LoadingSpinner, EmptyState, Pagination, SearchInput } from '../components/UI';
import { useDebouncedValue } from '../utils/search';

const ACTION_COLORS: Record<string, string> = {
  login: 'badge-green',
  logout: 'badge-blue',
  error: 'badge-red',
  api_call: 'badge-purple',
  endpoint_create: 'badge-yellow',
  endpoint_update: 'badge-yellow',
  endpoint_delete: 'badge-red',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    api.getLogs(page, limit, filter || undefined, debouncedSearch)
      .then((res) => {
        setLogs(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, limit, filter, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const handleFilter = (action: string) => {
    setFilter(action);
    setPage(1);
  };

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="System activity and API call logs" />

      <SearchInput
        className="mb-4"
        value={search}
        onChange={setSearch}
        placeholder="Search by message, action or IP..."
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'login', 'error', 'api_call', 'endpoint_create', 'endpoint_update', 'endpoint_delete'].map((action) => (
          <button
            key={action}
            onClick={() => handleFilter(action)}
            className={`btn-secondary py-1.5 text-xs ${filter === action ? 'ring-2 ring-primary-500' : ''}`}
          >
            {action || 'All'}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : logs.length === 0 ? (
        <EmptyState message={search ? 'No logs match your search' : 'No logs found'} />
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="table-container border-0 rounded-none">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Message</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Response Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td className="text-xs text-dark-muted whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <span className={ACTION_COLORS[log.action] || 'badge-blue'}>
                        {log.action}
                      </span>
                    </td>
                    <td className="max-w-xs truncate">{log.message}</td>
                    <td className="text-dark-muted">{log.userId?.login || '-'}</td>
                    <td>
                      {log.statusCode && (
                        <span className={log.statusCode < 400 ? 'badge-green' : 'badge-red'}>
                          {log.statusCode}
                        </span>
                      )}
                    </td>
                    <td className="text-dark-muted text-xs">
                      {log.responseTime ? `${log.responseTime}ms` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(l) => { setLimit(l); setPage(1); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
