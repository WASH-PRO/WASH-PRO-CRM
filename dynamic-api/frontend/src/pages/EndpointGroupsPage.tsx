import { useEffect, useState, useMemo } from 'react';
import { Plus, Trash2, Edit, Folder } from 'lucide-react';
import { api } from '../services/api';
import { EndpointGroup } from '../types';
import { PageHeader, LoadingSpinner, EmptyState, Modal, Pagination, SearchInput } from '../components/UI';
import { matchesSearch } from '../utils/search';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

const emptyForm = { name: '', description: '', icon: 'folder', color: '#3b82f6', order: 0 };

export default function EndpointGroupsPage() {
  const [groups, setGroups] = useState<EndpointGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(9);
  const [search, setSearch] = useState('');

  const filteredGroups = useMemo(() => groups.filter((group) =>
    matchesSearch(search, group.name, group.description, group.color, group.order)
  ), [groups, search]);

  const total = filteredGroups.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginated = filteredGroups.slice((page - 1) * limit, page * limit);

  const load = () => {
    setLoading(true);
    api.getEndpointGroups()
      .then(setGroups)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => { setPage(1); }, [search]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, order: groups.length });
    setModalOpen(true);
  };

  const openEdit = (group: EndpointGroup) => {
    setEditingId(group._id);
    setForm({
      name: group.name,
      description: group.description || '',
      icon: group.icon || 'folder',
      color: group.color || '#3b82f6',
      order: group.order,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.updateEndpointGroup(editingId, form);
      } else {
        await api.createEndpointGroup(form);
      }
      closeModal();
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this endpoint group?')) return;
    try {
      await api.deleteEndpointGroup(id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <div>
      <PageHeader
        title="Endpoint Groups"
        subtitle="Organize endpoints into logical groups (CRM, SHOP, DEVICES...)"
        action={
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="w-4 h-4" /> New Group
          </button>
        }
      />

      <SearchInput
        className="mb-4"
        value={search}
        onChange={setSearch}
        placeholder="Search by name, description or color..."
      />

      {loading ? <LoadingSpinner /> : groups.length === 0 ? (
        <EmptyState message="No endpoint groups yet. Create one to organize your APIs." />
      ) : filteredGroups.length === 0 ? (
        <EmptyState message="No endpoint groups match your search" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginated.map((group) => (
            <div key={group._id} className="endpoint-group-card" style={{ borderLeftColor: group.color || '#3b82f6' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${group.color}20`, color: group.color }}
                  >
                    <Folder className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{group.name}</h3>
                    <span className="text-xs text-dark-muted">Order: {group.order}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="btn-secondary py-1 px-2" onClick={() => openEdit(group)}>
                    <Edit className="w-3 h-3" />
                  </button>
                  <button className="btn-danger py-1 px-2" onClick={() => handleDelete(group._id)}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-dark-muted mb-3 min-h-[40px]">
                {group.description || 'No description'}
              </p>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border border-dark-border" style={{ backgroundColor: group.color }} />
                <span className="text-xs font-mono text-dark-muted">{group.color}</span>
              </div>
            </div>
          ))}
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} limit={limit}
            onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} limitOptions={[9, 18, 27]} />
        </>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editingId ? 'Edit Endpoint Group' : 'Create Endpoint Group'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="CRM, SHOP, DEVICES..." required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              className="input min-h-[80px] resize-none"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What endpoints belong to this group?"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Display Order</label>
              <input type="number" className="input" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Color</label>
              <div className="flex gap-2 items-center">
                <input type="color" className="w-10 h-10 rounded cursor-pointer border-0" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                <input className="input flex-1 font-mono text-xs" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Quick Colors</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setForm({ ...form, color: c })}
                />
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary w-full justify-center">
            {editingId ? 'Save Changes' : 'Create Group'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
