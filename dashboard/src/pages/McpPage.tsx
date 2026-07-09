import { useCallback, useMemo, useState } from 'react';
import { Bot, Check, Copy, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { getToken } from '../api/client';
import { getDapMcpTools, PYORCH_MCP_TOOLS, checkPyorchMcpReachable } from '../api/mcp';
import { PageHeader, Loading, ErrorMessage, Badge, Empty } from '../components/UI';
import { DataTable, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { usePolling } from '../hooks/usePolling';
import { useEmbeddedServices } from '../hooks/useEmbeddedServices';

type ServiceId = 'dynamic-api' | 'pyorchestrator';

interface McpToolRow {
  name: string;
  description: string;
  category?: string;
  method?: string;
}

const PYORCH_CATEGORY_LABELS: Record<string, string> = {
  auth: 'Авторизация',
  scripts: 'Скрипты',
  runs: 'Запуски',
  organization: 'Организация',
  automation: 'Автоматизация',
  secrets: 'Секреты',
  platform: 'Платформа',
};

function inferHttpMethod(toolName: string): string | undefined {
  const match = toolName.match(/^(get|post|put|patch|delete)_/i);
  return match ? match[1]!.toUpperCase() : undefined;
}

function methodBadgeVariant(method: string): 'default' | 'success' | 'warning' | 'error' {
  switch (method) {
    case 'GET':
      return 'success';
    case 'POST':
      return 'default';
    case 'PUT':
    case 'PATCH':
      return 'warning';
    case 'DELETE':
      return 'error';
    default:
      return 'default';
  }
}

interface ServiceMeta {
  id: ServiceId;
  label: string;
  subtitle: string;
  mcpPath: string;
  panelMcpPath: string;
  needsAuth: boolean;
}

const SERVICES: ServiceMeta[] = [
  {
    id: 'dynamic-api',
    label: 'Dynamic API',
    subtitle: 'CRM, SCADA, карты, статистика — все endpoints платформы',
    mcpPath: '/api/mcp',
    panelMcpPath: '/mcp',
    needsAuth: true,
  },
  {
    id: 'pyorchestrator',
    label: 'PyOrchestrator',
    subtitle: 'Скрипты, Telegram-боты, расписания, webhooks',
    mcpPath: '/api/pyorch-mcp/mcp',
    panelMcpPath: '/mcp',
    needsAuth: false,
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button type="button" onClick={() => void copy()} className="btn-secondary !px-2 !py-1.5 text-xs" title="Копировать">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100 dark:bg-slate-950">
        <code>{code}</code>
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

function statusLabel(status: string): string {
  if (status === 'online') return 'Запущен';
  if (status === 'offline') return 'Остановлен';
  return 'Проверка…';
}

export function McpPage() {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const embedded = useEmbeddedServices();
  const [activeId, setActiveId] = useState<ServiceId>('dynamic-api');

  const fetchDapTools = useCallback((signal: AbortSignal) => getDapMcpTools(signal), []);
  const { data: dapTools, loading: dapLoading, error: dapError } = usePolling(fetchDapTools, [], {
    intervalMs: 60_000,
    live: false,
  });

  const fetchPyorchOk = useCallback((signal: AbortSignal) => checkPyorchMcpReachable(signal), []);
  const { data: pyorchMcpOk } = usePolling(fetchPyorchOk, [], { intervalMs: 30_000, live: false });

  const service = SERVICES.find((s) => s.id === activeId)!;
  const mcpUrl = `${origin}${service.mcpPath}`;

  const embeddedMeta = embedded.find((s) => s.id === service.id);
  const panelUrl = embeddedMeta ? `${embeddedMeta.panelUrl}${service.panelMcpPath}` : null;

  const online =
    service.id === 'dynamic-api'
      ? embeddedMeta?.status === 'online'
      : embeddedMeta?.status === 'online' && pyorchMcpOk === true;

  const tools: McpToolRow[] = useMemo(
    () =>
      service.id === 'dynamic-api'
        ? (dapTools ?? []).map((t) => ({
            name: t.name,
            description: t.description,
            method: inferHttpMethod(t.name),
          }))
        : PYORCH_MCP_TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            category: t.category,
          })),
    [service.id, dapTools]
  );

  const toolColumns: DataTableColumn<McpToolRow>[] = useMemo(() => {
    const cols: DataTableColumn<McpToolRow>[] = [];
    if (service.id === 'dynamic-api') {
      cols.push({
        key: 'method',
        header: 'Метод',
        className: 'w-0 whitespace-nowrap',
        sortValue: (t) => t.method ?? '',
        searchValue: (t) => t.method ?? '',
        render: (t) =>
          t.method ? (
            <Badge variant={methodBadgeVariant(t.method)}>{t.method}</Badge>
          ) : (
            <span className="text-panel-muted dark:text-panel-muted-dark">—</span>
          ),
      });
    } else {
      cols.push({
        key: 'category',
        header: 'Категория',
        className: 'w-0 whitespace-nowrap',
        sortValue: (t) => t.category ?? '',
        searchValue: (t) => PYORCH_CATEGORY_LABELS[t.category ?? ''] ?? t.category ?? '',
        render: (t) => (
          <Badge variant="default">{PYORCH_CATEGORY_LABELS[t.category ?? ''] ?? t.category ?? '—'}</Badge>
        ),
      });
    }
    cols.push(
      {
        key: 'name',
        header: 'Инструмент',
        sortValue: (t) => t.name,
        searchValue: (t) => `${t.name} ${t.description}`,
        render: (t) => (
          <code className="inline-block max-w-full break-all rounded-md bg-brand-50 px-2 py-1 font-mono text-xs leading-relaxed text-brand-800 ring-1 ring-brand-500/15 dark:bg-brand-400/10 dark:text-brand-200 dark:ring-brand-400/20">
            {t.name}
          </code>
        ),
      },
      {
        key: 'description',
        header: 'Описание',
        sortValue: (t) => t.description,
        searchValue: (t) => t.description,
        render: (t) => (
          <p className="max-w-2xl text-sm leading-relaxed text-panel-muted dark:text-panel-muted-dark">{t.description}</p>
        ),
      }
    );
    return cols;
  }, [service.id]);

  const toolFilters: DataTableFilter<McpToolRow>[] = useMemo(() => {
    if (service.id !== 'pyorchestrator') return [];
    const categories = [...new Set(PYORCH_MCP_TOOLS.map((t) => t.category))];
    return [
      {
        id: 'category',
        label: 'Категория',
        options: categories.map((c) => ({ value: c, label: PYORCH_CATEGORY_LABELS[c] ?? c })),
        match: (t, v) => t.category === v,
      },
    ];
  }, [service.id]);

  const sampleTool = tools[0]?.name ?? (service.id === 'dynamic-api' ? 'get_api_crm_washes' : 'list_scripts');
  const tokenPlaceholder = getToken() ? '<ваш_JWT_из_сессии_CRM>' : '<access_token>';

  const authHeadersExample = `Authorization: Bearer ${tokenPlaceholder}
# или
X-API-Key: dap_<ваш_ключ>
# или
Authorization: ApiKey dap_<ваш_ключ>`;

  const listToolsExample = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, null, 2);

  const callToolExample = JSON.stringify(
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: sampleTool,
        arguments: { query: {}, body: {}, params: {} },
      },
    },
    null,
    2
  );

  const curlListExample = `curl -X POST ${mcpUrl} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${tokenPlaceholder}" \\
  -d '${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })}'`;

  const curlCallExample = `curl -X POST ${mcpUrl} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${tokenPlaceholder}" \\
  -d '${JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: sampleTool, arguments: { query: {}, body: {}, params: {} } },
  })}'`;

  const cursorConfig = useMemo(() => {
    const servers: Record<string, { url: string; headers?: Record<string, string> }> = {
      'wash-pro-dynamic-api': {
        url: `${origin}/api/mcp`,
        headers: { Authorization: `Bearer ${tokenPlaceholder}` },
      },
    };
    if (embedded.find((s) => s.id === 'pyorchestrator')?.status === 'online') {
      servers['wash-pro-pyorchestrator'] = { url: `${origin}/api/pyorch-mcp/mcp` };
    }
    return JSON.stringify({ mcpServers: servers }, null, 2);
  }, [origin, tokenPlaceholder, embedded]);

  const showDapLoading = service.id === 'dynamic-api' && dapLoading && !dapTools;

  return (
    <div>
      <PageHeader
        title="MCP сервер"
        subtitle="Model Context Protocol — AI-агенты (Cursor и др.) работают с CRM через HTTP, без сборки"
        icon={Bot}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {SERVICES.map((svc) => {
          const emb = embedded.find((e) => e.id === svc.id);
          const isOnline =
            svc.id === 'dynamic-api' ? emb?.status === 'online' : emb?.status === 'online' && pyorchMcpOk;
          return (
            <button
              key={svc.id}
              type="button"
              onClick={() => setActiveId(svc.id)}
              className={clsx(
                'rounded-lg border px-4 py-3 text-left transition-colors',
                activeId === svc.id
                  ? 'border-brand-500/40 bg-brand-500/10'
                  : 'border-panel-border bg-panel-card hover:border-brand-500/25 dark:border-panel-border-dark dark:bg-panel-card-dark'
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    'h-2 w-2 rounded-full',
                    isOnline ? 'bg-emerald-500' : emb?.status === 'checking' ? 'bg-amber-400 animate-pulse' : 'bg-slate-400'
                  )}
                />
                <span className="font-medium text-panel-ink dark:text-panel-ink-dark">{svc.label}</span>
              </div>
              <p className="mt-1 text-xs text-panel-muted dark:text-panel-muted-dark">{statusLabel(emb?.status ?? 'checking')}</p>
            </button>
          );
        })}
      </div>

      <div className="card mb-4 flex items-start gap-3 border border-brand-500/20 bg-brand-500/5 p-4 text-sm">
        <Bot className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-panel-ink dark:text-panel-ink-dark">
            {service.label} — JSON-RPC 2.0
          </p>
          <p className="mt-1 text-panel-muted dark:text-panel-muted-dark">
            <code className="text-brand-700 dark:text-brand-300">POST {service.mcpPath}</code>
            {service.needsAuth && (
              <>
                {' '}
                — на каждый запрос нужна авторизация (JWT сессии CRM или API key Dynamic API).
              </>
            )}
            {!service.needsAuth && (
              <> — сервис в Docker, учётные данные PyOrchestrator заданы в окружении контейнера.</>
            )}
            {' '}
            Методы: <code className="text-brand-700 dark:text-brand-300">initialize</code>,{' '}
            <code className="text-brand-700 dark:text-brand-300">tools/list</code>,{' '}
            <code className="text-brand-700 dark:text-brand-300">tools/call</code>
            {service.id === 'dynamic-api' && (
              <>
                , <code className="text-brand-700 dark:text-brand-300">resources/list</code>,{' '}
                <code className="text-brand-700 dark:text-brand-300">resources/read</code>
              </>
            )}
            .
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-panel-canvas px-2 py-1 text-xs dark:bg-panel-sidebar-hover">{mcpUrl}</code>
            <CopyButton text={mcpUrl} />
            {panelUrl && (
              <a
                href={panelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary btn-sm inline-flex items-center gap-1"
              >
                Панель {service.label} <ExternalLink size={14} />
              </a>
            )}
          </div>
          {!online && service.id === 'pyorchestrator' && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              PyOrchestrator или MCP-сервис не запущен. Включите{' '}
              <code className="text-xs">PYORCHESTRATOR_ENABLED=true</code> и перезапустите стек.
            </p>
          )}
        </div>
      </div>

      <div className="card mb-6 space-y-4 p-4">
        <h3 className="text-sm font-semibold text-panel-ink dark:text-panel-ink-dark">Cursor — готовый конфиг (HTTP)</h3>
        <p className="text-xs text-panel-muted dark:text-panel-muted-dark">
          Settings → MCP или <code className="text-xs">~/.cursor/mcp.json</code>. Сборка не требуется — только URL через Dashboard.
        </p>
        <CodeBlock code={cursorConfig} />
      </div>

      {service.needsAuth && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <h3 className="mb-1 text-sm font-semibold">Заголовки авторизации</h3>
            <p className="mb-3 text-xs text-panel-muted dark:text-panel-muted-dark">
              Те же учётные данные, что для прямых вызовов <code className="text-brand-700 dark:text-brand-300">/api/…</code>.
              API keys создаются в панели Dynamic API.
            </p>
            <CodeBlock code={authHeadersExample} />
          </div>
          <div className="card p-4">
            <h3 className="mb-1 text-sm font-semibold">Правила доступа</h3>
            <ul className="list-disc space-y-1.5 pl-4 text-xs text-panel-muted dark:text-panel-muted-dark">
              <li>
                <code className="text-brand-700 dark:text-brand-300">tools/list</code> — только инструменты, доступные токену.
              </li>
              <li>
                <code className="text-brand-700 dark:text-brand-300">tools/call</code> — те же проверки{' '}
                <code className="text-brand-700 dark:text-brand-300">accessType</code>, что у endpoint.
              </li>
              <li>Таблица ниже — полный список (вид администратора).</li>
              <li>Без токена — <strong>401 Unauthorized</strong>.</li>
            </ul>
          </div>
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-1 text-sm font-semibold">tools/list — тело запроса</h3>
          <p className="mb-2 text-xs text-panel-muted dark:text-panel-muted-dark">
            {service.needsAuth ? 'Добавьте заголовки авторизации.' : 'POST на URL выше.'}
          </p>
          <CodeBlock code={listToolsExample} />
        </div>
        <div className="card p-4">
          <h3 className="mb-1 text-sm font-semibold">tools/call — тело запроса</h3>
          <p className="mb-2 text-xs text-panel-muted dark:text-panel-muted-dark">Пример с инструментом «{sampleTool}».</p>
          <CodeBlock code={callToolExample} />
        </div>
      </div>

      {service.needsAuth && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">curl — tools/list</h3>
            <CodeBlock code={curlListExample} />
          </div>
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">curl — tools/call</h3>
            <CodeBlock code={curlCallExample} />
          </div>
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-panel-ink dark:text-panel-ink-dark">
            Зарегистрированные инструменты
            {tools.length > 0 && (
              <span className="ml-2 font-normal text-panel-muted dark:text-panel-muted-dark">({tools.length})</span>
            )}
          </h3>
          <p className="mt-1 text-xs text-panel-muted dark:text-panel-muted-dark">
            {service.id === 'dynamic-api'
              ? 'Все включённые endpoints CRM (вид администратора).'
              : 'Инструменты MCP-сервера PyOrchestrator в Docker.'}
          </p>
        </div>

        {showDapLoading ? (
          <Loading />
        ) : service.id === 'dynamic-api' && dapError ? (
          <ErrorMessage message={dapError} />
        ) : tools.length === 0 ? (
          <div className="table-shell px-4 py-10">
            <Empty
              message={
                service.id === 'pyorchestrator' && !online
                  ? 'MCP PyOrchestrator недоступен.'
                  : 'Инструменты пока не зарегистрированы.'
              }
            />
          </div>
        ) : (
          <DataTable
            tableId={`mcp-tools-${service.id}`}
            columns={toolColumns}
            data={tools}
            rowKey={(t) => t.name}
            searchPlaceholder="Поиск по имени или описанию…"
            filters={toolFilters}
            defaultSortKey="name"
            defaultSortDir="asc"
            pageSize={40}
            emptyMessage="Ничего не найдено"
          />
        )}
      </section>
    </div>
  );
}
