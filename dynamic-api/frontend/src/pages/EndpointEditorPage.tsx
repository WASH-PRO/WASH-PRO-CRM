import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, GripVertical, Send, FileText, Code, Settings } from 'lucide-react';
import { api } from '../services/api';
import { Endpoint, EndpointGroup, SchemaField, TestResult } from '../types';
import { PageHeader, MethodBadge, LoadingSpinner, SearchInput } from '../components/UI';
import { matchesSearch } from '../utils/search';

const FIELD_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'datetime', 'json'];

export default function EndpointEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [endpointGroups, setEndpointGroups] = useState<EndpointGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'general' | 'schema' | 'test' | 'docs'>('general');
  const [saving, setSaving] = useState(false);

  const [testBody, setTestBody] = useState('{}');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [examples, setExamples] = useState<{ request: Record<string, unknown>; response: Record<string, unknown> } | null>(null);
  const [docs, setDocs] = useState<Record<string, unknown> | null>(null);
  const [fieldSearch, setFieldSearch] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getEndpoint(id),
      api.getEndpointGroups(),
      api.getEndpointExamples(id).catch(() => null),
      api.getEndpointDocs(id).catch(() => null),
    ]).then(([ep, groups, ex, doc]) => {
      setEndpoint(ep);
      setEndpointGroups(groups);
      if (ex) {
        setExamples(ex);
        setTestBody(JSON.stringify(ex.request, null, 2));
      }
      if (doc) setDocs(doc as Record<string, unknown>);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    if (!endpoint || !id) return;
    setSaving(true);
    try {
      const updated = await api.updateEndpoint(id, {
        name: endpoint.name,
        description: endpoint.description,
        groupId: endpoint.groupId?._id || null,
        schema: endpoint.fields,
        accessType: endpoint.accessType,
        enabled: endpoint.enabled,
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
    fields[index] = { ...fields[index], ...updates };
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
      const result = await api.testEndpoint(id, { body });
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

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Settings },
    { id: 'schema' as const, label: 'Schema', icon: Code },
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
        subtitle={endpoint.description || endpoint.path}
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
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-dark-muted hover:text-dark-text'
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
              <input className="input font-mono text-sm bg-dark-hover" value={endpoint.path} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Method</label>
              <div className="pt-2"><MethodBadge method={endpoint.method} /></div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={endpoint.enabled} onChange={(e) => setEndpoint({ ...endpoint, enabled: e.target.checked })} />
            Endpoint enabled
          </label>
        </div>
      )}

      {tab === 'schema' && (
        <div className="space-y-4">
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
                  <div key={index} className="flex items-start gap-3 p-3 bg-dark-bg rounded-md border border-dark-border">
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
                ))}
              </div>
            )}
          </div>

          {examples && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card">
                <h4 className="text-sm font-semibold mb-2">Example Request</h4>
                <pre className="text-xs bg-dark-bg p-3 rounded-md overflow-auto max-h-48 font-mono text-green-400">
                  {JSON.stringify(examples.request, null, 2)}
                </pre>
              </div>
              <div className="card">
                <h4 className="text-sm font-semibold mb-2">Example Response</h4>
                <pre className="text-xs bg-dark-bg p-3 rounded-md overflow-auto max-h-48 font-mono text-blue-400">
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
              <span className="font-mono text-sm text-dark-muted">{endpoint.path}</span>
            </div>

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
                <pre className="text-xs bg-dark-bg p-3 rounded-md overflow-auto max-h-64 font-mono">
                  {JSON.stringify(testResult.response.body, null, 2)}
                </pre>
              </div>

              <div className="card">
                <h4 className="text-sm font-semibold mb-2">Request</h4>
                <pre className="text-xs bg-dark-bg p-3 rounded-md overflow-auto max-h-32 font-mono text-dark-muted">
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
          <div>
            <h4 className="text-sm font-semibold mb-2">Parameters</h4>
            {Array.isArray(docs.parameters) && (docs.parameters as SchemaField[]).length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
                  <tbody>
                    {(docs.parameters as SchemaField[]).map((p, i) => (
                      <tr key={i}>
                        <td className="font-mono">{p.name}</td>
                        <td><span className="badge-purple">{p.type}</span></td>
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
              <pre className="text-xs bg-dark-bg p-3 rounded-md overflow-auto font-mono">
                {JSON.stringify(docs.requestBody, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Example Response</h4>
              <pre className="text-xs bg-dark-bg p-3 rounded-md overflow-auto font-mono">
                {JSON.stringify(docs.exampleResponse, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
