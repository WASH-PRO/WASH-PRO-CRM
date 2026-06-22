import { useEffect, useState } from 'react';
import { apiList } from '../api/client';
import { PageHeader, Table, Loading, Badge } from '../components/UI';
import type { PostState, Post } from '../types';

function formatDuration(sec?: number) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function StatesPage() {
  const [states, setStates] = useState<PostState[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiList<PostState>('/crm/post-states'), apiList<Post>('/crm/posts')])
      .then(([s, p]) => { setStates(s); setPosts(p); })
      .finally(() => setLoading(false));
  }, []);

  const postName = (id: string) => {
    const p = posts.find((x) => x.id === id);
    return p ? `#${p.postNumber} ${p.name}` : id.slice(-6);
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Текущее состояние" subtitle="Режимы работы и состояние оборудования постов" />
      <Table>
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
          <tr>
            <th className="px-4 py-3">Пост</th>
            <th className="px-4 py-3">Режим</th>
            <th className="px-4 py-3">№ режима</th>
            <th className="px-4 py-3">Беспл. пауза</th>
            <th className="px-4 py-3">Платн. пауза</th>
            <th className="px-4 py-3">Время режима</th>
            <th className="px-4 py-3">Связь</th>
            <th className="px-4 py-3">Последнее сообщ.</th>
          </tr>
        </thead>
        <tbody>
          {states.map((s) => (
            <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="px-4 py-3 font-medium">{postName(s.postId)}</td>
              <td className="px-4 py-3">{s.modeName || s.mode || '—'}</td>
              <td className="px-4 py-3">{s.modeNumber ?? '—'}</td>
              <td className="px-4 py-3">{formatDuration(s.freePause)}</td>
              <td className="px-4 py-3">{formatDuration(s.paidPause)}</td>
              <td className="px-4 py-3">{formatDuration(s.modeTime)}</td>
              <td className="px-4 py-3">
                <Badge variant={s.connected ? 'success' : 'warning'}>{s.connected ? 'Да' : 'Нет'}</Badge>
              </td>
              <td className="px-4 py-3 text-sm">{s.lastMessageAt ? new Date(s.lastMessageAt).toLocaleString('ru') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
