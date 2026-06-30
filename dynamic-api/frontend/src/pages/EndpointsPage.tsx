import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Edit, Lock, Pencil, Folder, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import { Endpoint, EndpointGroup } from '../types';
import { PageHeader, MethodBadge, LoadingSpinner, EmptyState, Modal, SearchInput } from '../components/UI';
import { getEndpointDisplayPath } from '../utils/apiPath';

const defaultForm = {
  name: '', description: '', slug: '', path: '/api/', method: 'GET',
  accessType: 'authenticated', groupId: '',
};

interface GroupSection {
  id: string;
  group: EndpointGroup | null;
  label: string;
  description?: string;
  color: string;
  endpoints: Endpoint[];
}

function EndpointRow({
  ep,
  onQuickEdit,
  onDelete,
}: {
  ep: Endpoint;
  onQuickEdit: (ep: Endpoint) => void;
  onDelete: (id: string, isSystem: boolean) => void;
}) {
  return (
    <tr>
      <td><MethodBadge method={ep.method} /></td>
      <td>
        <div className="flex items-center gap-2">
          {ep.isSystem && <Lock className="w-3 h-3 text-yellow-400 shrink-0" />}
          <span className="font-medium">{ep.name}</span>
        </div>
      </td>
      <td className="text-dark-muted text-sm max-w-[220px] truncate" title={ep.description}>
        {ep.description || '—'}
      </td>
      <td className="font-mono text-xs text-dark-muted" title={getEndpointDisplayPath(ep.path, ep.apiVersion)}>
        {getEndpointDisplayPath(ep.path, ep.apiVersion)}
      </td>
      <td className="text-center">
        {ep.fields?.some((f) => f.type === 'reference') ? (
          <span className="badge-purple" title="Schema contains reference (foreign key) fields">
            {ep.fields.filter((f) => f.type === 'reference').length} link{ep.fields.filter((f) => f.type === 'reference').length === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="text-dark-muted text-xs">—</span>
        )}
      </td>
      <td className="text-center">{ep.callCount}</td>
      <td>
        <span className={ep.enabled ? 'badge-green' : 'badge-red'}>
          {ep.enabled ? 'Active' : 'Disabled'}
        </span>
      </td>
      <td>
        <div className="flex gap-1 justify-end">
          <button className="btn-secondary py-1 px-2" title="Edit name & description" onClick={() => onQuickEdit(ep)}>
            <Pencil className="w-3 h-3" />
          </button>
          <Link to={`/endpoints/${ep._id}`} className="btn-secondary py-1 px-2" title="Full editor">
            <Edit className="w-3 h-3" />
          </Link>
          {!ep.isSystem && (
            <button className="btn-danger py-1 px-2" onClick={() => onDelete(ep._id, ep.isSystem)}>
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function GroupedTable({
  section,
  collapsed,
  onToggle,
  onQuickEdit,
  onDelete,
}: {
  section: GroupSection;
  collapsed: boolean;
  onToggle: () => void;
  onQuickEdit: (ep: Endpoint) => void;
  onDelete: (id: string, isSystem: boolean) => void;
}) {
  return (
    <div className="endpoint-group-section" style={{ borderLeftColor: section.color }}>
      <button type="button" className="endpoint-group-header" onClick={onToggle}>
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${section.color}20`, color: section.color }}
          >
            <Folder className="w-4 h-4" />
          </div>
          <div className="text-left min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{section.label}</h3>
              <span className="badge text-xs" style={{ backgroundColor: `${section.color}20`, color: section.color }}>
                {section.endpoints.length}
              </span>
            </div>
            {section.description && (
              <p className="text-xs text-dark-muted truncate">{section.description}</p>
            )}
          </div>
        </div>
        {collapsed ? <ChevronRight className="w-4 h-4 text-dark-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-dark-muted shrink-0" />}
      </button>

      {!collapsed && (
        <div className="endpoint-group-body">
          {section.endpoints.length === 0 ? (
            <p className="text-sm text-dark-muted text-center py-6">No endpoints in this group</p>
          ) : (
            <div className="table-container border-0 rounded-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Path</th>
                    <th className="text-center">Links</th>
                    <th className="text-center">Calls</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {section.endpoints.map((ep) => (
                    <EndpointRow key={ep._id} ep={ep} onQuickEdit={onQuickEdit} onDelete={onDelete} />
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

export default function EndpointsPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [endpointGroups, setEndpointGroups] = useState<EndpointGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const load = () => {
    setLoading(true);
    Promise.all([api.getEndpoints(1, 500), api.getEndpointGroups()])
      .then(([eps, groups]) => {
        setEndpoints(eps.data);
        setEndpointGroups(groups);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => endpoints.filter((ep) => {
    const q = search.toLowerCase();
    const displayPath = getEndpointDisplayPath(ep.path, ep.apiVersion);
    return ep.name.toLowerCase().includes(q) ||
      ep.path.toLowerCase().includes(q) ||
      displayPath.toLowerCase().includes(q) ||
      (ep.apiVersion || '').toLowerCase().includes(q) ||
      (ep.description || '').toLowerCase().includes(q);
  }), [endpoints, search]);

  const sections = useMemo((): GroupSection[] => {
    const result: GroupSection[] = [];
    const sorted = [...endpointGroups].sort((a, b) => a.order - b.order);

    for (const g of sorted) {
      if (filterGroup && filterGroup !== g._id) continue;
      const eps = filtered.filter((ep) => ep.groupId?._id === g._id);
      result.push({
        id: g._id,
        group: g,
        label: g.name,
        description: g.description,
        color: g.color || '#3b82f6',
        endpoints: eps,
      });
    }

    if (!filterGroup || filterGroup === 'none') {
      const ungrouped = filtered.filter((ep) => !ep.groupId);
      result.push({
        id: '__ungrouped__',
        group: null,
        label: 'Without group',
        description: 'Endpoints not assigned to any group',
        color: '#64748b',
        endpoints: ungrouped,
      });
    }

    return result.filter((s) => !filterGroup || s.endpoints.length > 0 || s.group);
  }, [filtered, endpointGroups, filterGroup]);

  const totalVisible = sections.reduce((sum, s) => sum + s.endpoints.length, 0);

  const toggleSection = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openCreate = (groupId = '') => {
    setForm({ ...defaultForm, groupId });
    setCreateOpen(true);
  };

  const openQuickEdit = (ep: Endpoint) => {
    setEditingId(ep._id);
    setForm({
      name: ep.name,
      description: ep.description || '',
      slug: ep.slug,
      path: ep.path,
      method: ep.method,
      accessType: ep.accessType,
      groupId: ep.groupId?._id || '',
    });
    setEditOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createEndpoint({ ...form, groupId: form.groupId || undefined });
      setCreateOpen(false);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create');
    }
  };

  const handleQuickEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await api.updateEndpoint(editingId, {
        name: form.name,
        description: form.description,
        groupId: form.groupId || null,
      });
      setEditOpen(false);
      setEditingId(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleDelete = async (id: string, isSystem: boolean) => {
    if (isSystem) return alert('Cannot delete system endpoint');
    if (!confirm('Delete this endpoint?')) return;
    try {
      await api.deleteEndpoint(id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const groupFormFields = (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          className="input min-h-[72px] resize-none"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="What does this endpoint do?"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Endpoint Group</label>
        <select className="select" value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
          <option value="">— No group —</option>
          {endpointGroups.map((g) => (
            <option key={g._id} value={g._id}>{g.name}</option>
          ))}
        </select>
      </div>
    </>
  );

  return (
    <div>
      <PageHeader
        title="Endpoints"
        subtitle={`${totalVisible} endpoint${totalVisible !== 1 ? 's' : ''} in ${sections.length} group${sections.length !== 1 ? 's' : ''}`}
        action={
          <button className="btn-primary" onClick={() => openCreate()}>
            <Plus className="w-4 h-4" /> New Endpoint
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput
          className="flex-1"
          value={search}
          onChange={setSearch}
          placeholder="Search by name, path or description..."
        />
        <select className="select sm:w-48" value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
          <option value="">All groups</option>
          <option value="none">Without group only</option>
          {endpointGroups.map((g) => (
            <option key={g._id} value={g._id}>{g.name}</option>
          ))}
        </select>
      </div>

      {endpointGroups.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-5">
          <button
            onClick={() => setFilterGroup('')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!filterGroup ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilterGroup('none')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${filterGroup === 'none' ? 'bg-slate-500 text-white border-slate-500' : 'border-slate-500/40 text-slate-400'}`}
          >
            Ungrouped
          </button>
          {endpointGroups.map((g) => (
            <button
              key={g._id}
              onClick={() => setFilterGroup(g._id)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-colors border"
              style={filterGroup === g._id
                ? { backgroundColor: g.color, borderColor: g.color, color: '#fff' }
                : { borderColor: `${g.color}40`, color: g.color }}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {loading ? <LoadingSpinner /> : totalVisible === 0 && sections.every((s) => s.endpoints.length === 0) ? (
        <EmptyState message="No endpoints found" />
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <GroupedTable
              key={section.id}
              section={section}
              collapsed={!!collapsed[section.id]}
              onToggle={() => toggleSection(section.id)}
              onQuickEdit={openQuickEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Endpoint">
        <form onSubmit={handleCreate} className="space-y-4">
          {groupFormFields}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Slug</label>
              <input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Method</label>
              <select className="select" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Path</label>
            <input className="input font-mono" value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Access</label>
            <select className="select" value={form.accessType} onChange={(e) => setForm({ ...form, accessType: e.target.value })}>
              <option value="public">Public</option>
              <option value="authenticated">Authenticated</option>
              <option value="group">Group</option>
            </select>
          </div>
          <button type="submit" className="btn-primary w-full justify-center">Create Endpoint</button>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => { setEditOpen(false); setEditingId(null); }} title="Edit Endpoint">
        <form onSubmit={handleQuickEdit} className="space-y-4">
          {groupFormFields}
          <button type="submit" className="btn-primary w-full justify-center">Save Changes</button>
        </form>
      </Modal>
    </div>
  );
}
