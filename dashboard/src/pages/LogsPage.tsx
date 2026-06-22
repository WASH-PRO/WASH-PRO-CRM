import { useEffect, useState } from 'react';
import { getSystemLogs } from '../api/client';
import { PageHeader, Table, Loading } from '../components/UI';
import type { LogEntry } from '../types';

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    getSystemLogs(page)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Системные логи" subtitle="Доступно только администраторам" />
      <Table>
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
          <tr>
            <th className="px-4 py-3">Действие</th>
            <th className="px-4 py-3">Сообщение</th>
            <th className="px-4 py-3">Код</th>
            <th className="px-4 py-3">IP</th>
            <th className="px-4 py-3">Дата</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="px-4 py-3 font-mono text-xs">{l.action}</td>
              <td className="px-4 py-3 text-sm">{l.message}</td>
              <td className="px-4 py-3">{l.statusCode || '—'}</td>
              <td className="px-4 py-3 font-mono text-xs">{l.ip || '—'}</td>
              <td className="px-4 py-3 text-sm">{new Date(l.createdAt).toLocaleString('ru')}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="mt-4 flex gap-2">
        <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Назад</button>
        <button className="btn-secondary" onClick={() => setPage((p) => p + 1)}>Далее</button>
      </div>
    </div>
  );
}
