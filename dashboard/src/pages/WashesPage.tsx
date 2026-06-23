import { FormEvent, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, apiList } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Table, Loading, Modal, ErrorMessage } from '../components/UI';
import type { Wash } from '../types';

const emptyForm = { name: '', description: '', address: '', registeredAt: undefined as string | undefined, cloudEnabled: false };

export function WashesPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('create', 'update', 'delete');
  const [items, setItems] = useState<Wash[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    apiList<Wash>('/crm/washes')
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setForm(emptyForm);
    setEditId(null);
    setModal(true);
  };

  const openEdit = (w: Wash) => {
    setForm({
      name: w.name,
      description: w.description || '',
      address: w.address,
      registeredAt: w.registeredAt,
      cloudEnabled: w.cloudEnabled ?? false,
    });
    setEditId(w.id);
    setModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const body = editId
        ? {
            name: form.name,
            description: form.description,
            address: form.address,
            registeredAt: form.registeredAt || new Date().toISOString(),
            cloudEnabled: form.cloudEnabled ?? false,
          }
        : {
            ...form,
            registeredAt: new Date().toISOString(),
            cloudEnabled: false,
          };
      if (editId) {
        await api(`/crm/washes/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/crm/washes', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить автомойку?')) return;
    try {
      await api(`/crm/washes/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Автомойки"
        subtitle="Управление автомойками самообслуживания"
        actions={canEdit && <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Добавить</button>}
      />
      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
      <Table>
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
          <tr>
            <th className="px-4 py-3 font-medium">Название</th>
            <th className="px-4 py-3 font-medium">Адрес</th>
            <th className="px-4 py-3 font-medium">Регистрация</th>
            {canEdit && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody>
          {items.map((w) => (
            <tr key={w.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="px-4 py-3">
                <div className="font-medium">{w.name}</div>
                {w.description && <div className="text-xs text-slate-500">{w.description}</div>}
              </td>
              <td className="px-4 py-3">{w.address}</td>
              <td className="px-4 py-3 text-sm">{w.registeredAt ? new Date(w.registeredAt).toLocaleDateString('ru') : '—'}</td>
              {canEdit && (
                <td className="px-4 py-3 text-right">
                  <button className="btn-secondary mr-2" onClick={() => openEdit(w)}>Изменить</button>
                  <button className="btn-secondary text-red-600" onClick={() => handleDelete(w.id)}>Удалить</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Редактировать' : 'Новая автомойка'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="label">Название</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="label">Описание</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="label">Адрес</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required /></div>
          <button type="submit" className="btn-primary w-full">Сохранить</button>
        </form>
      </Modal>
    </div>
  );
}
