import { FormEvent, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, apiList } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Table, Loading, Modal, Badge, statusLabel } from '../components/UI';
import type { Post, Wash } from '../types';

export function PostsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('create', 'update');
  const [posts, setPosts] = useState<Post[]>([]);
  const [washes, setWashes] = useState<Wash[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ washId: '', postNumber: 1, name: '', serialNumber: '', status: 'offline' as Post['status'] });

  const load = async () => {
    setLoading(true);
    const [p, w] = await Promise.all([apiList<Post>('/crm/posts'), apiList<Wash>('/crm/washes')]);
    setPosts(p);
    setWashes(w);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const washName = (id: string) => washes.find((w) => w.id === id)?.name || id.slice(-6);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api('/crm/posts', {
      method: 'POST',
      body: JSON.stringify({ ...form, postNumber: Number(form.postNumber), settings: {} }),
    });
    setModal(false);
    load();
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Посты"
        subtitle="Управление постами автомоек"
        actions={canEdit && <button className="btn-primary" onClick={() => setModal(true)}><Plus size={16} /> Добавить</button>}
      />
      <Table>
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
          <tr>
            <th className="px-4 py-3">№</th>
            <th className="px-4 py-3">Название</th>
            <th className="px-4 py-3">Автомойка</th>
            <th className="px-4 py-3">Серийный №</th>
            <th className="px-4 py-3">Статус</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="px-4 py-3 font-mono">{p.postNumber}</td>
              <td className="px-4 py-3 font-medium">{p.name}</td>
              <td className="px-4 py-3">{washName(p.washId)}</td>
              <td className="px-4 py-3 font-mono text-xs">{p.serialNumber}</td>
              <td className="px-4 py-3">
                <Badge variant={p.status === 'online' ? 'success' : p.status === 'error' ? 'error' : 'warning'}>
                  {statusLabel[p.status] || p.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal open={modal} onClose={() => setModal(false)} title="Новый пост">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Автомойка</label>
            <select className="input" value={form.washId} onChange={(e) => setForm({ ...form, washId: e.target.value })} required>
              <option value="">Выберите...</option>
              {washes.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div><label className="label">Номер поста</label><input className="input" type="number" min={1} value={form.postNumber} onChange={(e) => setForm({ ...form, postNumber: Number(e.target.value) })} required /></div>
          <div><label className="label">Название</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="label">Серийный номер</label><input className="input" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} required /></div>
          <button type="submit" className="btn-primary w-full">Создать</button>
        </form>
      </Modal>
    </div>
  );
}
