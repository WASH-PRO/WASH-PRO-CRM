import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { api } from '../services/api';
import { User, Group } from '../types';
import { PageHeader, LoadingSpinner, EmptyState, Modal, Pagination, SearchInput } from '../components/UI';
import { useDebouncedValue } from '../utils/search';

const emptyForm = {
  login: '', email: '', password: '', name: '',
  status: 'active' as User['status'], groupIds: [] as string[],
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.getUsers(page, limit, debouncedSearch), api.getGroups()])
      .then(([usersRes, groupsRes]) => {
        setUsers(usersRes.data);
        setTotal(usersRes.total);
        setTotalPages(usersRes.totalPages);
        setGroups(groupsRes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, limit, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingId(user._id);
    setForm({
      login: user.login, email: user.email, password: '', name: user.name,
      status: user.status,
      groupIds: (user.groupIds || []).map((g) => (typeof g === 'string' ? g : g._id)),
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm(emptyForm); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const payload: Record<string, unknown> = {
          login: form.login, email: form.email, name: form.name,
          status: form.status, groupIds: form.groupIds,
        };
        if (form.password) payload.password = form.password;
        await api.updateUser(editingId, payload);
      } else {
        await api.createUser(form);
      }
      closeModal();
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    try {
      await api.deleteUser(id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage system users"
        action={<button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> New User</button>}
      />

      <SearchInput
        className="mb-4"
        value={search}
        onChange={setSearch}
        placeholder="Search by name, login, email or status..."
      />

      {loading ? <LoadingSpinner /> : users.length === 0 ? (
        <EmptyState message={search ? 'No users match your search' : 'No users found'} />
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="table-container border-0 rounded-none">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th><th>Login</th><th>Email</th><th>Groups</th>
                  <th>Status</th><th>Last Login</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td className="font-medium">{user.name}</td>
                    <td>{user.login}</td>
                    <td className="text-dark-muted">{user.email}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(user.groupIds || []).map((g) => (
                          <span key={typeof g === 'string' ? g : g._id} className="badge-blue">
                            {typeof g === 'string' ? g : g.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td><span className={user.status === 'active' ? 'badge-green' : 'badge-red'}>{user.status}</span></td>
                    <td className="text-dark-muted text-xs">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn-secondary py-1 px-2" onClick={() => openEdit(user)}><Edit className="w-3 h-3" /></button>
                        <button className="btn-danger py-1 px-2" onClick={() => handleDelete(user._id)}><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <Pagination page={page} totalPages={totalPages} total={total} limit={limit}
              onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editingId ? 'Edit User' : 'Create User'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Login</label>
              <input className="input" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Password {editingId && <span className="text-dark-muted font-normal">(leave empty to keep)</span>}
            </label>
            <input type="password" className="input" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingId} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as User['status'] })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Groups</label>
            <select className="select min-h-[100px]" multiple value={form.groupIds}
              onChange={(e) => setForm({ ...form, groupIds: Array.from(e.target.selectedOptions, (o) => o.value) })}>
              {groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary w-full justify-center">{editingId ? 'Save Changes' : 'Create User'}</button>
        </form>
      </Modal>
    </div>
  );
}
