import { useEffect, useState, useMemo } from 'react';
import { Plus, Trash2, Lock, Edit } from 'lucide-react';
import { api } from '../services/api';
import { Group } from '../types';
import { PageHeader, LoadingSpinner, EmptyState, Modal, SearchInput } from '../components/UI';
import { matchesSearch } from '../utils/search';

const ALL_PERMISSIONS = ['view', 'create', 'update', 'delete', 'manage_users', 'manage_api', 'view_logs'];

const emptyForm = { name: '', description: '', permissions: ['view'] as string[] };

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingIsSystem, setEditingIsSystem] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');

  const filteredGroups = useMemo(() => groups.filter((group) =>
    matchesSearch(search, group.name, group.description, ...group.permissions)
  ), [groups, search]);

  const load = () => {
    setLoading(true);
    api.getGroups()
      .then(setGroups)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setEditingIsSystem(false);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (group: Group) => {
    setEditingId(group._id);
    setEditingIsSystem(group.isSystem);
    setForm({
      name: group.name,
      description: group.description || '',
      permissions: [...group.permissions],
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setEditingIsSystem(false);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.updateGroup(editingId, form);
      } else {
        await api.createGroup(form);
      }
      closeModal();
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDelete = async (id: string, isSystem: boolean) => {
    if (isSystem) return alert('Cannot delete system group');
    if (!confirm('Delete this group?')) return;
    try {
      await api.deleteGroup(id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  const togglePermission = (perm: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  return (
    <div>
      <PageHeader
        title="User Groups"
        subtitle="Manage RBAC user groups and permissions"
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
        placeholder="Search by name, description or permission..."
      />

      {loading ? <LoadingSpinner /> : groups.length === 0 ? (
        <EmptyState message="No groups found" />
      ) : filteredGroups.length === 0 ? (
        <EmptyState message="No groups match your search" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => (
            <div key={group._id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {group.isSystem && <Lock className="w-4 h-4 text-yellow-400" />}
                  <h3 className="font-semibold">{group.name}</h3>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary py-1 px-2" onClick={() => openEdit(group)}>
                    <Edit className="w-3 h-3" />
                  </button>
                  {!group.isSystem && (
                    <button className="btn-danger py-1 px-2" onClick={() => handleDelete(group._id, group.isSystem)}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-dark-muted mb-3">{group.description || 'No description'}</p>
              <div className="flex flex-wrap gap-1">
                {group.permissions.map((p) => (
                  <span key={p} className="badge-purple">{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit Group' : 'Create Group'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              disabled={editingIsSystem}
            />
            {editingIsSystem && (
              <p className="text-xs text-dark-muted mt-1">System group name cannot be changed</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Permissions</label>
            <div className="flex flex-wrap gap-2">
              {ALL_PERMISSIONS.map((perm) => (
                <button
                  key={perm}
                  type="button"
                  onClick={() => togglePermission(perm)}
                  className={`badge cursor-pointer transition-colors ${
                    form.permissions.includes(perm) ? 'badge-blue' : 'bg-dark-hover text-dark-muted'
                  }`}
                >
                  {perm}
                </button>
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
