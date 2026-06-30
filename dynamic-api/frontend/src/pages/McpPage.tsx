import { useEffect, useMemo, useState } from 'react';
import { Bot, Copy, Check } from 'lucide-react';
import { api } from '../services/api';
import { PageHeader, LoadingSpinner } from '../components/UI';

type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button type="button" onClick={copy} className="btn-secondary !px-2 !py-1.5 text-xs" title="Copy">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100 dark:bg-slate-950">
        <code>{code}</code>
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

export default function McpPage() {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loading, setLoading] = useState(true);

  const mcpUrl = useMemo(() => `${window.location.origin}/api/mcp`, []);

  useEffect(() => {
    api.getMcpTools()
      .then((data) => setTools(data as McpTool[]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const sampleTool = tools[0]?.name || 'get_api_products';

  const authHeadersExample = `Authorization: Bearer <access_token>
# or
X-API-Key: dap_<your_key>
# or
Authorization: ApiKey dap_<your_key>`;

  const listToolsExample = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
  }, null, 2);

  const callToolExample = JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: sampleTool,
      arguments: { query: {}, body: {}, params: {} },
    },
  }, null, 2);

  const curlListExample = `curl -X POST ${mcpUrl} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <access_token>" \\
  -d '${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })}'`;

  const curlApiKeyExample = `curl -X POST ${mcpUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: dap_<your_key>" \\
  -d '${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })}'`;

  const curlCallExample = `curl -X POST ${mcpUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: dap_<your_key>" \\
  -d '${JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: sampleTool, arguments: { query: {}, body: {}, params: {} } },
  })}'`;

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="MCP Server"
        subtitle="Model Context Protocol — expose dynamic API endpoints as AI agent tools"
      />

      <div className="card mb-4 flex items-start gap-3 border border-brand-500/20 bg-brand-500/5 p-4 text-sm">
        <Bot className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
        <div>
          <p className="font-medium text-slate-800 dark:text-slate-100">JSON-RPC 2.0 endpoint</p>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            <code className="text-accent">POST /api/mcp</code> requires authentication on every request.
            Use the same credentials as for direct <code className="text-accent">/api/…</code> calls.
            Methods: <code className="text-accent">initialize</code>,{' '}
            <code className="text-accent">tools/list</code>,{' '}
            <code className="text-accent">tools/call</code>,{' '}
            <code className="text-accent">resources/list</code>,{' '}
            <code className="text-accent">resources/read</code> (<code className="text-accent">openapi://spec</code>).
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">{mcpUrl}</code>
            <CopyButton text={mcpUrl} />
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-1 text-sm font-semibold">Authentication headers</h3>
          <p className="mb-3 text-xs text-slate-500">
            Required for all JSON-RPC calls. API keys from <strong>API Keys</strong> work here and on direct{' '}
            <code className="text-accent">/api/…</code> routes.
          </p>
          <CodeBlock code={authHeadersExample} />
        </div>
        <div className="card p-4">
          <h3 className="mb-1 text-sm font-semibold">Access rules</h3>
          <ul className="list-disc space-y-1.5 pl-4 text-xs text-slate-600 dark:text-slate-400">
            <li><code className="text-accent">tools/list</code> returns only tools the token can access (public, authenticated, or group).</li>
            <li><code className="text-accent">tools/call</code> runs the endpoint with the same <code className="text-accent">accessType</code> checks.</li>
            <li>This admin table lists <strong>all</strong> registered tools; agents see a filtered list.</li>
            <li>Without a valid token the server responds with <strong>401 Unauthorized</strong>.</li>
          </ul>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-1 text-sm font-semibold">List tools — request body</h3>
          <p className="mb-2 text-xs text-slate-500">Add authentication headers from above.</p>
          <CodeBlock code={listToolsExample} />
        </div>
        <div className="card p-4">
          <h3 className="mb-1 text-sm font-semibold">Call a tool — request body</h3>
          <p className="mb-2 text-xs text-slate-500">Add authentication headers from above.</p>
          <CodeBlock code={callToolExample} />
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">curl — list tools (Bearer)</h3>
          <CodeBlock code={curlListExample} />
        </div>
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">curl — call tool (API key)</h3>
          <CodeBlock code={curlCallExample} />
        </div>
      </div>

      <div className="card mb-4 overflow-hidden p-4">
        <h3 className="mb-2 text-sm font-semibold">curl — list tools (API key)</h3>
        <CodeBlock code={curlApiKeyExample} />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h3 className="text-sm font-semibold">
            Registered tools ({tools.length})
          </h3>
          <p className="text-xs text-slate-500">
            All enabled non-system endpoints (admin view). Descriptions show the public URL including API version when set.
          </p>
        </div>
        {tools.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No tools yet. Create and enable endpoints to expose them via MCP.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tool name</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.name}>
                  <td>
                    <code className="text-xs">{tool.name}</code>
                  </td>
                  <td className="text-sm text-slate-600 dark:text-slate-400">{tool.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
