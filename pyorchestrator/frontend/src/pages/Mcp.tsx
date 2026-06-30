import { useCallback, useMemo, useState } from "react";
import { ClipboardDocumentIcon } from "@heroicons/react/20/solid";
import PageContainer, { Col, PageContent, PageGrid } from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import MetricsStrip, { type MetricItem } from "@/components/ui/MetricsStrip";
import Panel from "@/components/ui/Panel";
import { EmptyRow, Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { API_URL, api } from "@/api/client";
import { useTranslation } from "@/context/LocaleContext";
import { useToast } from "@/context/ToastContext";

interface McpTool {
  name: string;
  category: string;
  description: string;
}

interface McpInfo {
  status: string;
  transport: string;
  http_url: string;
  tools: McpTool[];
  resource: string;
}

function statusTone(status: string): BadgeTone {
  if (status === "ok") return "success";
  if (status.startsWith("error")) return "danger";
  return "warning";
}

function CodeBlock({ value, onCopy }: { value: string; onCopy: () => void }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl bg-inset p-4 text-xs leading-relaxed text-foreground-secondary ring-1 ring-ring-line">
        {value}
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-2 top-2"
        onClick={onCopy}
      >
        <ClipboardDocumentIcon className="size-4" />
      </Button>
    </div>
  );
}

export default function McpPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [configMode, setConfigMode] = useState<"stdio" | "http">("stdio");

  const fetchInfo = useCallback(() => api<McpInfo>("/api/v1/mcp/info"), []);
  const { data: info, reload, refreshing, lastUpdated } = useLiveQuery(fetchInfo, [], {
    intervalMs: 30_000,
  });

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(t("mcp.copied"));
  };

  const stdioConfig = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            pyorchestrator: {
              command: "python3",
              args: ["-m", "pyorchestrator_mcp"],
              cwd: "${workspaceFolder}/mcp",
              env: {
                PYORCH_API_URL: API_URL,
                PYORCH_EMAIL: "admin@pyorchestrator.local",
                PYORCH_PASSWORD: "admin",
              },
            },
          },
        },
        null,
        2,
      ),
    [],
  );

  const httpConfig = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            pyorchestrator: {
              url: info?.http_url ?? "http://localhost:8010/mcp",
            },
          },
        },
        null,
        2,
      ),
    [info?.http_url],
  );

  const metrics = useMemo<MetricItem[]>(
    () => [
      {
        label: t("mcp.metrics.status"),
        value: info?.status ?? "—",
        tone: info ? (info.status === "ok" ? "success" : "danger") : "default",
      },
      {
        label: t("mcp.metrics.transport"),
        value: info?.transport ?? "—",
        tone: "accent",
      },
      {
        label: t("mcp.metrics.tools"),
        value: info?.tools.length ?? "—",
        tone: "default",
      },
      {
        label: t("mcp.metrics.resource"),
        value: info?.resource?.replace("pyorch://", "") ?? "—",
        tone: "default",
      },
    ],
    [info, t],
  );

  const tools = info?.tools ?? [];

  return (
    <PageContainer>
      <PageHeader
        title={t("mcp.title")}
        subtitle={t("mcp.subtitle")}
        onRefresh={reload}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
      />

      <PageContent>
        <MetricsStrip items={metrics} />

        <PageGrid className="items-stretch">
          <Col span={6}>
            <Panel title={t("mcp.endpoint.title")} subtitle={t("mcp.endpoint.subtitle")} bodyClassName="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <code className="rounded-lg bg-inset px-3 py-2 text-sm text-cyan-400 ring-1 ring-ring-line">
                  {info?.http_url ?? "http://localhost:8010/mcp"}
                </code>
                {info && <Badge label={info.status} tone={statusTone(info.status)} />}
              </div>
              <p className="text-sm leading-relaxed text-muted">{t("mcp.endpoint.hint")}</p>
              <Button type="button" variant="secondary" onClick={() => copy(info?.http_url ?? "")}>
                {t("mcp.copyUrl")}
              </Button>
            </Panel>
          </Col>

          <Col span={6}>
            <Panel title={t("mcp.cursor.title")} subtitle={t("mcp.cursor.subtitle")} bodyClassName="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={configMode === "stdio" ? "primary" : "secondary"}
                  onClick={() => setConfigMode("stdio")}
                >
                  {t("mcp.cursor.stdio")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={configMode === "http" ? "primary" : "secondary"}
                  onClick={() => setConfigMode("http")}
                >
                  {t("mcp.cursor.http")}
                </Button>
              </div>
              <p className="text-sm text-muted">
                {configMode === "stdio" ? t("mcp.cursor.stdioHint") : t("mcp.cursor.httpHint")}
              </p>
              <CodeBlock
                value={configMode === "stdio" ? stdioConfig : httpConfig}
                onCopy={() => copy(configMode === "stdio" ? stdioConfig : httpConfig)}
              />
            </Panel>
          </Col>

          <Col span={12}>
            <Panel title={t("mcp.tools.title")} subtitle={t("mcp.tools.subtitle")} flush bodyClassName="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>{t("mcp.tools.columns.name")}</TH>
                    <TH>{t("mcp.tools.columns.category")}</TH>
                    <TH>{t("mcp.tools.columns.description")}</TH>
                  </TR>
                </THead>
                <TBody>
                  {tools.length === 0 ? (
                    <EmptyRow colSpan={3} message={t("common.loading")} />
                  ) : (
                    tools.map((tool) => (
                      <TR key={tool.name}>
                        <TD className="font-mono text-xs text-cyan-400">{tool.name}</TD>
                        <TD>{tool.category}</TD>
                        <TD className="text-muted">{tool.description}</TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </Panel>
          </Col>
        </PageGrid>
      </PageContent>
    </PageContainer>
  );
}
