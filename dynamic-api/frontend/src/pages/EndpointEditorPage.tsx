import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, GripVertical, Send, FileText, Code, Settings, Shield, Braces } from 'lucide-react';
import { api } from '../services/api';
import { Endpoint, EndpointGroup, SchemaField, TestResult } from '../types';
import { PageHeader, MethodBadge, LoadingSpinner, SearchInput } from '../components/UI';
import NetworkAccessEditor, { DEFAULT_NETWORK_ACCESS } from '../components/NetworkAccessEditor';
import { matchesSearch } from '../utils/search';
import { getDefaultTestPath, getEndpointDisplayPath, getEndpointPublicPaths } from '../utils/apiPath';

const FIELD_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'datetime', 'json', 'reference'];

const DEFAULT_HANDLER_CODE = `async function handler(req, db) {
  // req: { method, path, params, query, body, user, headers }
  // db:  { findOne, find, create, update, delete } for this endpoint's collection
  //
  // Example:
  // const record = await db.findOne({ email: req.body.email });
  // return { status: 200, data: record };

  return { status: 200, data: { message: 'Handler active — replace with your logic' } };
}`;

export default function EndpointEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [endpointGroups, setEndpointGroups] = useState<EndpointGroup[]>([]);
  const [refEndpoints, setRefEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'general' | 'network' | 'schema' | 'handler' | 'test' | 'docs'>(() => {
    const t = searchParams.get('tab');
    return t === 'general' || t === 'network' || t === 'schema' || t === 'handler' || t === 'test' || t === 'docs' ? t : 'general';
  });
  const [saving, setSaving] = useState(false);

  const [testBody, setTestBody] = useState('{}');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [examples, setExamples] = useState<{ request: Record<string, unknown>; response: Record<string, unknown> } | null>(null);
  const [docs, setDocs] = useState<Record<string, unknown> | null>(null);
  const [fieldSearch, setFieldSearch] = useState('');
  const [testPopulate, setTestPopulate] = useState('');
  const [testApplyNetworkAccess, setTestApplyNetworkAccess] = useState(false);
  const [testClientIp, setTestClientIp] = useState('');
  const [testOrigin, setTestOrigin] = useState('');
  const [testPath, setTestPath] = useState('');

  const refEndpointLabel = (refEndpointId?: string) => {
    if (!refEndpointId) return '—';
    const target = refEndpoints.find((ep) => ep._id === refEndpointId);
    return target ? `${target.method} ${getEndpointDisplayPath(target.path, target.apiVersion)} — ${target.name}` : refEndpointId;
  };

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getEndpoint(id),
      api.getEndpointGroups(),
      api.getEndpoints(1, 200),
      api.getEndpointExamples(id).catch(() => null),
      api.getEndpointDocs(id).catch(() => null),
    ]).then(([ep, groups, endpointList, ex, doc]) => {
      setEndpoint({
        ...ep,
        networkAccess: ep.networkAccess || { ...DEFAULT_NETWORK_ACCESS },
        inheritGroupNetworkAccess: ep.inheritGroupNetworkAccess !== false,
        handlers: ep.handlers?.length
          ? ep.handlers
          : [{ name: 'main', type: 'javascript', code: DEFAULT_HANDLER_CODE, enabled: false }],
      });
      setEndpointGroups(groups);
      setRefEndpoints(endpointList.data.filter((item) => !item.isSystem && item._id !== id));
      if (ex) {
        setExamples(ex);
        setTestBody(JSON.stringify(ex.request, null, 2));
      }
      if (doc) setDocs(doc as Record<string, unknown>);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!endpoint) return;
    setTestPath(getDefaultTestPath(endpoint.path, endpoint.apiVersion));
  }, [endpoint?.path, endpoint?.apiVersion]);

  const testPaths = useMemo(
    () => (endpoint ? getEndpointPublicPaths(endpoint.path, endpoint.apiVersion) : []),
    [endpoint?.path, endpoint?.apiVersion]
  );

  const save = async () => {
    if (!endpoint || !id) return;
    setSaving(true);
    try {
      const updated = await api.updateEndpoint(id, {
        name: endpoint.name,
        description: endpoint.description,
        path: endpoint.path,
        groupId: endpoint.groupId?._id || null,
        schema: endpoint.fields,
        accessType: endpoint.accessType,
        enabled: endpoint.enabled,
        networkAccess: endpoint.networkAccess,
        inheritGroupNetworkAccess: endpoint.inheritGroupNetworkAccess,
        handlers: endpoint.handlers,
        apiVersion: endpoint.apiVersion?.trim() || null,
        dataRetentionDays: endpoint.dataRetentionDays ?? null,
      });
      setEndpoint(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addField = () => {
    if (!endpoint) return;
    const newField: SchemaField = {
      name: `field_${endpoint.fields.length + 1}`,
      type: 'string',
      required: false,
      order: endpoint.fields.length,
    };
    setEndpoint({ ...endpoint, fields: [...endpoint.fields, newField] });
  };

  const updateField = (index: number, updates: Partial<SchemaField>) => {
    if (!endpoint) return;
    const fields = [...endpoint.fields];
    const next = { ...fields[index], ...updates };
    if (updates.type && updates.type !== 'reference') {
      delete next.refEndpointId;
    }
    fields[index] = next;
    setEndpoint({ ...endpoint, fields });
  };

  const removeField = (index: number) => {
    if (!endpoint) return;
    setEndpoint({ ...endpoint, fields: endpoint.fields.filter((_, i) => i !== index) });
  };

  const runTest = async () => {
    if (!id) return;
    setTesting(true);
    setTestResult(null);
    try {
      let body: unknown;
      try { body = JSON.parse(testBody); } catch { body = testBody; }
      const result = await api.testEndpoint(id, {
        path: testPath || getDefaultTestPath(endpoint?.path || '', endpoint?.apiVersion),
        body,
        query: endpoint?.method === 'GET' && testPopulate.trim()
          ? { populate: testPopulate.trim() }
          : undefined,
        applyNetworkAccess: testApplyNetworkAccess,
        clientIp: testClientIp.trim() || undefined,
        headers: testOrigin.trim() ? { Origin: testOrigin.trim() } : undefined,
      });
      setTestResult(result);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const visibleFields = useMemo(() => {
    if (!endpoint) return [];
    return endpoint.fields
      .map((field, index) => ({ field, index }))
      .filter(({ field }) => matchesSearch(fieldSearch, field.name, field.type, field.description));
  }, [endpoint, fieldSearch]);

  if (loading) return <LoadingSpinner />;
  if (!endpoint) return <div>Endpoint not found</div>;

  const jsHandler = endpoint.handlers.find((h) => h.type === 'javascript') || {
    name: 'main',
    type: 'javascript',
    code: DEFAULT_HANDLER_CODE,
    enabled: false,
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Settings },
    { id: 'network' as const, label: 'Network Access', icon: Shield },
    { id: 'schema' as const, label: 'Schema', icon: Code },
    { id: 'handler' as const, label: 'Handler', icon: Braces },
    { id: 'test' as const, label: 'Test', icon: Send },
    { id: 'docs' as const, label: 'Docs', icon: FileText },
  ];

  return (
    <div>
      <button onClick={() => navigate('/endpoints')} className="btn-secondary mb-4 py-1.5">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <PageHeader
        title={endpoint.name}
        subtitle={endpoint.description || getEndpointDisplayPath(endpoint.path, endpoint.apiVersion)}
        action={
          <div className="flex items-center gap-2">
            <MethodBadge method={endpoint.method} />
            {endpoint.isSystem && <span className="badge-yellow">System</span>}
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        }
      />

      <div className="flex gap-1 mb-6 border-b border-dark-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-brand-500 text-brand-600 dark:text-brand-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="card space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input className="input" value={endpoint.name} onChange={(e) => setEndpoint({ ...endpoint, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              className="input min-h-[100px] resize-none"
              value={endpoint.description || ''}
              onChange={(e) => setEndpoint({ ...endpoint, description: e.target.value })}
              placeholder="Describe what this endpoint does..."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Endpoint Group</label>
              <select
                className="select"
                value={endpoint.groupId?._id || ''}
                onChange={(e) => {
                  const g = endpointGroups.find((gr) => gr._id === e.target.value);
                  setEndpoint({ ...endpoint, groupId: e.target.value ? g : undefined });
                }}
              >
                <option value="">— No group —</option>
                {endpointGroups.map((g) => (
                  <option key={g._id} value={g._id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Access Type</label>
              <select className="select" value={endpoint.accessType} onChange={(e) => setEndpoint({ ...endpoint, accessType: e.target.value as Endpoint['accessType'] })}>
                <option value="public">Public</option>
                <option value="authenticated">Authenticated</option>
                <option value="group">Group</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Path</label>
              <input
                className={`input font-mono text-sm ${endpoint.isSystem ? 'bg-dark-hover/50' : ''}`}
                value={endpoint.path}
                readOnly={endpoint.isSystem}
                onChange={(e) => setEndpoint({ ...endpoint, path: e.target.value })}
                placeholder="/api/example"
              />
              {!endpoint.isSystem && (
                <p className="text-xs text-dark-muted mt-1">
                  Changing the path moves this endpoint&apos;s stored records to the new collection.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Method</label>
              <div className="pt-2"><MethodBadge method={endpoint.method} /></div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">API Version</label>
            <input
              className="input font-mono max-w-xs"
              placeholder="v1, v2… (optional)"
              value={endpoint.apiVersion || ''}
              onChange={(e) => setEndpoint({ ...endpoint, apiVersion: e.target.value || undefined })}
            />
            <p className="text-xs text-dark-muted mt-1">
              Public URL:{' '}
              <code className="text-accent">{getEndpointDisplayPath(endpoint.path, endpoint.apiVersion)}</code>
              {endpoint.apiVersion && (
                <>
                  {' '}· base path{' '}
                  <code className="text-accent">{endpoint.path}</code> also matches
                </>
              )}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={endpoint.enabled} onChange={(e) => setEndpoint({ ...endpoint, enabled: e.target.checked })} />
            Endpoint enabled
          </label>
          <div>
            <label className="block text-sm font-medium mb-1">Data retention (days)</label>
            <input
              type="number"
              min={1}
              className="input max-w-xs"
              placeholder="Forever"
              value={endpoint.dataRetentionDays ?? ''}
              onChange={(e) => {
                const raw = e.target.value.trim();
                setEndpoint({
                  ...endpoint,
                  dataRetentionDays: raw === '' ? undefined : Math.max(1, parseInt(raw, 10) || 1),
                });
              }}
            />
            <p className="text-xs text-dark-muted mt-1">
              MongoDB auto-deletes records after this many days. Leave empty to keep data forever.
            </p>
          </div>
        </div>
      )}

      {tab === 'network' && (
        <div className="max-w-2xl">
          <NetworkAccessEditor
            value={endpoint.networkAccess || DEFAULT_NETWORK_ACCESS}
            onChange={(networkAccess) => setEndpoint({ ...endpoint, networkAccess })}
            showInheritOption
            inheritFromGroup={endpoint.inheritGroupNetworkAccess !== false}
            onInheritFromGroupChange={(inheritGroupNetworkAccess) =>
              setEndpoint({ ...endpoint, inheritGroupNetworkAccess })
            }
          />
        </div>
      )}

      {tab === 'handler' && (
        <div className="space-y-4 max-w-4xl">
          <div className="card p-4 border border-brand-500/30 bg-brand-500/5">
            <p className="text-sm text-dark-muted">
              Write <code className="text-accent">async function handler(req, db)</code> in JavaScript.
              When enabled, it <strong>replaces</strong> default schema CRUD for this endpoint.
              Changes apply immediately — no server restart.
            </p>
          </div>
          <div className="card space-y-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={jsHandler.enabled}
                onChange={(e) => {
                  const handlers = endpoint.handlers.filter((h) => h.type !== 'javascript');
                  handlers.push({ ...jsHandler, enabled: e.target.checked });
                  setEndpoint({ ...endpoint, handlers });
                }}
              />
              Enable JavaScript handler
            </label>
            <textarea
              className="input font-mono text-sm min-h-[360px] resize-y"
              value={jsHandler.code || ''}
              spellCheck={false}
              onChange={(e) => {
                const handlers = endpoint.handlers.filter((h) => h.type !== 'javascript');
                handlers.push({ ...jsHandler, code: e.target.value });
                setEndpoint({ ...endpoint, handlers });
              }}
            />
            <p className="text-xs text-dark-muted">
              Return <code>{`{ status: 200, data: ... }`}</code> or <code>{`{ success: true, data: ... }`}</code>.
              <code className="ml-1">db</code> methods: findOne, find, create, update, delete (scoped to this endpoint).
            </p>
          </div>
        </div>
      )}

      {tab === 'schema' && (
        <div className="space-y-4">
          <div className="card p-4 border border-purple-500/30 bg-purple-500/5">
            <p className="text-sm text-dark-muted">
              <span className="font-medium text-dark-text">Foreign keys:</span> add a field with type{' '}
              <span className="badge-purple">reference</span>, then choose the target endpoint under the field row.
              Values are record IDs from that endpoint; use <code className="text-accent">?populate=true</code> on GET to embed linked data.
            </p>
          </div>
          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold text-sm">Schema Fields</h3>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                {endpoint.fields.length > 0 && (
                  <SearchInput
                    className="sm:w-64"
                    value={fieldSearch}
                    onChange={setFieldSearch}
                    placeholder="Search fields..."
                  />
                )}
                <button className="btn-primary py-1.5" onClick={addField}>
                  <Plus className="w-4 h-4" /> Add Field
                </button>
              </div>
            </div>

            {endpoint.fields.length === 0 ? (
              <p className="text-dark-muted text-sm text-center py-6">No fields defined. Add fields to define your endpoint schema.</p>
            ) : visibleFields.length === 0 ? (
              <p className="text-dark-muted text-sm text-center py-6">No fields match your search</p>
            ) : (
              <div className="space-y-3">
                {visibleFields.map(({ field, index }) => (
                  <div key={index} className="p-3 bg-dark-hover/60 rounded-md border border-dark-border space-y-2">
                    <div className="flex items-start gap-3">
                      <GripVertical className="w-4 h-4 text-dark-muted mt-2.5 cursor-grab" />
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <input className="input" value={field.name} onChange={(e) => updateField(index, { name: e.target.value })} placeholder="Field name" />
                        <select className="select" value={field.type} onChange={(e) => updateField(index, { type: e.target.value })}>
                          {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input className="input" value={field.description || ''} onChange={(e) => updateField(index, { description: e.target.value })} placeholder="Description" />
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={field.required} onChange={(e) => updateField(index, { required: e.target.checked })} />
                          Required
                        </label>
                      </div>
                      <button className="btn-danger py-1 px-2 mt-1" onClick={() => removeField(index)}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    {field.type === 'reference' && (
                      <div className="ml-7">
                        <label className="block text-xs text-dark-muted mb-1">Linked endpoint (foreign key target)</label>
                        <select
                          className="select max-w-xl"
                          value={field.refEndpointId || ''}
                          onChange={(e) => updateField(index, { refEndpointId: e.target.value || undefined })}
                        >
                          <option value="">— Select endpoint —</option>
                          {refEndpoints.map((ep) => (
                            <option key={ep._id} value={ep._id}>
                              {ep.method} {getEndpointDisplayPath(ep.path, ep.apiVersion)} — {ep.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-dark-muted mt-1">
                          Stores a record ID from the selected endpoint. Use <code className="text-accent">?populate=true</code> on GET to embed linked data.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {examples && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card">
                <h4 className="text-sm font-semibold mb-2">Example Request</h4>
                <pre className="code-block-success max-h-48">
                  {JSON.stringify(examples.request, null, 2)}
                </pre>
              </div>
              <div className="card">
                <h4 className="text-sm font-semibold mb-2">Example Response</h4>
                <pre className="code-block-info max-h-48">
                  {JSON.stringify(examples.response, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'test' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card space-y-4">
            <div className="flex items-center gap-3">
              <MethodBadge method={endpoint.method} />
              {testPaths.length > 1 ? (
                <select
                  className="select font-mono text-sm flex-1"
                  value={testPath}
                  onChange={(e) => setTestPath(e.target.value)}
                >
                  {testPaths.map((path) => (
                    <option key={path} value={path}>{path}</option>
                  ))}
                </select>
              ) : (
                <span className="font-mono text-sm text-dark-muted">{testPath || getEndpointDisplayPath(endpoint.path, endpoint.apiVersion)}</span>
              )}
            </div>
            {endpoint.apiVersion && testPaths.length > 1 && (
              <p className="text-xs text-dark-muted">
                API version <code className="text-accent">{endpoint.apiVersion}</code> — choose which public path to send in the test request.
              </p>
            )}

            {endpoint.method === 'GET' && (
              <div>
                <label className="block text-sm font-medium mb-1">Populate references (optional)</label>
                <input
                  className="input font-mono text-sm"
                  value={testPopulate}
                  onChange={(e) => setTestPopulate(e.target.value)}
                  placeholder="true or categoryId,authorId"
                />
                <p className="text-xs text-dark-muted mt-1">Query param <code>?populate=</code> — use <strong>true</strong> for all reference fields.</p>
              </div>
            )}

            {endpoint.method !== 'GET' && endpoint.method !== 'DELETE' && (
              <div>
                <label className="block text-sm font-medium mb-1">Request Body (JSON)</label>
                <textarea
                  className="input font-mono text-xs h-48 resize-none"
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                />
              </div>
            )}

            <div className="border-t border-dark-border pt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={testApplyNetworkAccess}
                  onChange={(e) => setTestApplyNetworkAccess(e.target.checked)}
                />
                Apply network access rules during test
              </label>
              {testApplyNetworkAccess && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Simulated client IP</label>
                    <input
                      className="input font-mono text-sm"
                      value={testClientIp}
                      onChange={(e) => setTestClientIp(e.target.value)}
                      placeholder="203.0.113.10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Origin header</label>
                    <input
                      className="input font-mono text-sm"
                      value={testOrigin}
                      onChange={(e) => setTestOrigin(e.target.value)}
                      placeholder="https://app.example.com"
                    />
                  </div>
                </>
              )}
            </div>

            <button className="btn-primary w-full justify-center py-2.5" onClick={runTest} disabled={testing}>
              <Send className="w-4 h-4" />
              {testing ? 'Sending...' : 'Send Request'}
            </button>
          </div>

          {testResult && (
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold">Response</h4>
                  <div className="flex items-center gap-3">
                    <span className={`badge ${testResult.response.statusCode < 400 ? 'badge-green' : 'badge-red'}`}>
                      {testResult.response.statusCode}
                    </span>
                    <span className="text-xs text-dark-muted">{testResult.response.responseTime}ms</span>
                  </div>
                </div>
                <pre className="code-block max-h-64">
                  {JSON.stringify(testResult.response.body, null, 2)}
                </pre>
              </div>

              <div className="card">
                <h4 className="text-sm font-semibold mb-2">Request</h4>
                <pre className="code-block max-h-32 text-dark-muted">
                  {JSON.stringify(testResult.request, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'docs' && docs && (
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <MethodBadge method={String(docs.method)} />
            <span className="font-mono">{String(docs.url)}</span>
          </div>
          <p className="text-dark-muted text-sm">{String(docs.description || '')}</p>
          <p className="text-sm">
            <span className="font-medium">Data retention:</span>{' '}
            {docs.dataRetentionDays ? `${String(docs.dataRetentionDays)} days` : 'Forever'}
          </p>
          <div>
            <h4 className="text-sm font-semibold mb-2">Parameters</h4>
            {Array.isArray(docs.parameters) && (docs.parameters as SchemaField[]).length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Name</th><th>Type</th><th>Linked endpoint</th><th>Required</th><th>Description</th></tr></thead>
                  <tbody>
                    {(docs.parameters as SchemaField[]).map((p, i) => (
                      <tr key={i}>
                        <td className="font-mono">{p.name}</td>
                        <td><span className="badge-purple">{p.type}</span></td>
                        <td className="text-xs text-dark-muted font-mono">
                          {p.type === 'reference' ? refEndpointLabel(p.refEndpointId) : '—'}
                        </td>
                        <td>{p.required ? 'Yes' : 'No'}</td>
                        <td className="text-dark-muted">{p.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-dark-muted text-sm">No parameters</p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Request Body</h4>
              <pre className="code-block">
                {JSON.stringify(docs.requestBody, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Example Response</h4>
              <pre className="code-block">
                {JSON.stringify(docs.exampleResponse, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
