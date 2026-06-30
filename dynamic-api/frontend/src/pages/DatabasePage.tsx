import { useCallback, useEffect, useState } from 'react';
import { Database, Eye, Pencil, Plus, Trash2, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { DbCollectionInfo } from '../types';
import { PageHeader, LoadingSpinner, EmptyState, Pagination, SearchInput, Modal } from '../components/UI';
import { useDebouncedValue } from '../utils/search';
import { useAuth } from '../context/AuthContext';
import { userHasPermission } from '../utils/permissions';
import { Navigate } from 'react-router-dom';

function previewDoc(doc: Record<string, unknown>): string {
  const copy = { ...doc };
  const text = JSON.stringify(copy);
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export default function DatabasePage() {
  const { user } = useAuth();
  const [collections, setCollections] = useState<DbCollectionInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'view' | 'edit' | 'create'>('view');
  const [editorJson, setEditorJson] = useState('{}');
  const [editorDocId, setEditorDocId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCollections = useCallback(() => {
    setLoading(true);
    api.getDbCollections()
      .then((data) => {
        setCollections(data);
        setSelected((prev) => prev || data[0]?.name || null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load collections'))
      .finally(() => setLoading(false));
  }, []);

  const loadDocuments = useCallback(() => {
    if (!selected) return;
    setDocsLoading(true);
    setError(null);
    api.getDbDocuments(selected, page, limit, debouncedSearch)
      .then((res) => {
        setDocuments(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load documents'))
      .finally(() => setDocsLoading(false));
  }, [selected, page, limit, debouncedSearch]);

  useEffect(() => { loadCollections(); }, [loadCollections]);
  useEffect(() => { loadDocuments(); }, [loadDocuments]);
  useEffect(() => { setPage(1); }, [debouncedSearch, selected]);

  if (!userHasPermission(user, 'manage_users')) {
    return <Navigate to="/" replace />;
  }

  const openView = (doc: Record<string, unknown>) => {
    setEditorMode('view');
    setEditorDocId(String(doc._id));
    setEditorJson(JSON.stringify(doc, null, 2));
    setEditorOpen(true);
  };

  const openEdit = (doc: Record<string, unknown>) => {
    setEditorMode('edit');
    setEditorDocId(String(doc._id));
    setEditorJson(JSON.stringify(doc, null, 2));
    setEditorOpen(true);
  };

  const openCreate = () => {
    setEditorMode('create');
    setEditorDocId(null);
    setEditorJson('{\n  \n}');
    setEditorOpen(true);
  };

  const saveDocument = async () => {
    if (!selected) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(editorJson);
    } catch {
      alert('Invalid JSON');
      return;
    }

    setSaving(true);
    try {
      if (editorMode === 'create') {
        await api.createDbDocument(selected, parsed);
      } else if (editorMode === 'edit' && editorDocId) {
        await api.updateDbDocument(selected, editorDocId, parsed);
      }
      setEditorOpen(false);
      loadCollections();
      loadDocuments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteDocument = async (id: string) => {
    if (!selected || !confirm('Delete this document permanently?')) return;
    try {
      await api.deleteDbDocument(selected, id);
      loadCollections();
      loadDocuments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const clearCollection = async () => {
    if (!selected || !selectedMeta?.clearable) return;
    const countLabel = (selectedMeta.count ?? 0).toLocaleString();
    const confirmed = confirm(
      `Delete all ${countLabel} documents in "${selectedMeta.label}" (${selected})?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    const typed = prompt(`Type "${selected}" to confirm collection deletion:`);
    if (typed !== selected) {
      if (typed !== null) alert('Collection name did not match. Deletion cancelled.');
      return;
    }

    setClearing(true);
    setError(null);
    try {
      const result = await api.clearDbCollection(selected);
      setPage(1);
      loadCollections();
      loadDocuments();
      alert(`Deleted ${result.deletedCount.toLocaleString()} documents from ${selectedMeta.label}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear collection';
      setError(message);
      alert(message);
    } finally {
      setClearing(false);
    }
  };

  const selectedMeta = collections.find((c) => c.name === selected);

  return (
    <div>
      <PageHeader
        title="Database"
        subtitle="Browse and edit MongoDB collections in raw JSON (requires manage_users)"
        action={
          <button className="btn-secondary py-1.5" onClick={() => { loadCollections(); loadDocuments(); }}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {error && (
        <div className="card mb-4 border border-red-500/40 bg-red-500/10 text-sm text-red-300">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 card !p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-dark-border flex items-center gap-2">
            <Database className="w-4 h-4 text-primary-400" />
            <span className="font-semibold text-sm">Collections</span>
          </div>
          {loading ? (
            <div className="p-4"><LoadingSpinner /></div>
          ) : (
            <ul className="divide-y divide-dark-border max-h-[480px] overflow-y-auto">
              {collections.map((col) => (
                <li key={col.name}>
                  <button
                    type="button"
                    onClick={() => setSelected(col.name)}
                    className={`w-full text-left px-4 py-3 hover:bg-dark-hover transition-colors ${selected === col.name ? 'bg-primary-500/10 border-l-2 border-primary-500' : ''}`}
                  >
                    <div className="font-medium text-sm">{col.label}</div>
                    <div className="text-xs text-dark-muted font-mono">{col.name}</div>
                    <div className="text-xs text-dark-muted mt-1">{col.count.toLocaleString()} documents</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-9 space-y-4">
          {selected && (
            <>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <div>
                  <h2 className="font-semibold">{selectedMeta?.label || selected}</h2>
                  <p className="text-xs text-dark-muted font-mono">{selected}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedMeta?.clearable && (
                    <button
                      className="btn-danger py-1.5"
                      onClick={clearCollection}
                      disabled={clearing || (selectedMeta.count ?? 0) === 0}
                      title={(selectedMeta.count ?? 0) === 0 ? 'Collection is already empty' : 'Delete all documents in this collection'}
                    >
                      <Trash2 className="w-4 h-4" />
                      {clearing ? 'Clearing…' : 'Clear collection'}
                    </button>
                  )}
                  <button className="btn-primary py-1.5" onClick={openCreate}>
                    <Plus className="w-4 h-4" /> New document
                  </button>
                </div>
              </div>

              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by _id, name, login, path, message..."
              />

              {docsLoading ? (
                <LoadingSpinner />
              ) : documents.length === 0 ? (
                <EmptyState message={search ? 'No documents match your search' : 'Collection is empty'} />
              ) : (
                <div className="card !p-0 overflow-hidden">
                  <div className="table-container border-0 rounded-none">
                    <table className="table">
                      <thead>
                        <tr>
                          <th className="w-48">_id</th>
                          <th>Preview (raw JSON)</th>
                          <th className="text-right w-32">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map((doc) => (
                          <tr key={String(doc._id)}>
                            <td className="font-mono text-xs align-top">{String(doc._id)}</td>
                            <td className="font-mono text-xs text-dark-muted align-top break-all">{previewDoc(doc)}</td>
                            <td className="align-top">
                              <div className="flex gap-1 justify-end">
                                <button className="btn-secondary py-1 px-2" title="View JSON" onClick={() => openView(doc)}>
                                  <Eye className="w-3 h-3" />
                                </button>
                                <button className="btn-secondary py-1 px-2" title="Edit JSON" onClick={() => openEdit(doc)}>
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button className="btn-danger py-1 px-2" title="Delete" onClick={() => deleteDocument(String(doc._id))}>
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 border-t border-dark-border">
                    <Pagination
                      page={page}
                      totalPages={totalPages}
                      total={total}
                      limit={limit}
                      onPageChange={setPage}
                      onLimitChange={(value) => { setLimit(value); setPage(1); }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        wide
        title={
          editorMode === 'create'
            ? `New document — ${selectedMeta?.label || selected}`
            : editorMode === 'edit'
              ? `Edit — ${editorDocId}`
              : `View — ${editorDocId}`
        }
      >
        <p className="text-xs text-dark-muted mb-3">
          Raw BSON-compatible JSON. ObjectId fields as 24-char hex strings. Passwords in <code>users</code> are redacted on read and cannot be set here.
        </p>
        <textarea
          className="input font-mono text-xs h-80 resize-y w-full"
          value={editorJson}
          onChange={(e) => setEditorJson(e.target.value)}
          readOnly={editorMode === 'view'}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" onClick={() => setEditorOpen(false)}>Close</button>
          {editorMode !== 'view' && (
            <button className="btn-primary" onClick={saveDocument} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
          {editorMode === 'view' && (
            <button className="btn-primary" onClick={() => setEditorMode('edit')}>Edit</button>
          )}
        </div>
      </Modal>
    </div>
  );
}
