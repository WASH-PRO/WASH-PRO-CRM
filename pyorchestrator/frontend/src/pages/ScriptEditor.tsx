import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import {
  ArrowPathIcon,
  ChevronRightIcon,
  PlayIcon,
  StopIcon,
} from "@heroicons/react/20/solid";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ScriptFileExplorer from "@/components/editor/ScriptFileExplorer";
import ScriptFileActions from "@/components/editor/ScriptFileActions";
import RefreshModeControl from "@/components/ui/RefreshModeControl";
import { api, wsUrl } from "@/api/client";
import { can, useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/context/LocaleContext";
import { useToast } from "@/context/ToastContext";
import { compareNumbers, useDataTable } from "@/hooks/useDataTable";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { defineEditorTheme, editorThemeName } from "@/lib/monacoTheme";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/cn";

interface Script {
  id: string;
  name: string;
  status: string;
  entrypoint: string;
}

interface ScriptFile {
  path: string;
  content: string | null;
}

interface Run {
  id: string;
  status: string;
  duration_ms: number | null;
}

interface RunLog {
  id: number;
  message: string;
  level: string;
}

const TERMINAL_RUN_STATUSES = new Set(["success", "failed", "timeout", "cancelled"]);
const ACTIVE_RUN_STATUSES = new Set(["running", "queued"]);

const SECTION_HEADER = "flex h-11 shrink-0 items-center border-b border-line px-4";

export default function ScriptEditorPage() {
  const { t } = useTranslation();
  const { resolved } = useTheme();
  const { id } = useParams<{ id: string }>();
  const [script, setScript] = useState<Script | null>(null);
  const [files, setFiles] = useState<ScriptFile[]>([]);
  const [activeFile, setActiveFile] = useState("main.py");
  const [content, setContent] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [outputOpen, setOutputOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attachedRunIdRef = useRef<string | null>(null);
  const { user } = useAuth();
  const toast = useToast();

  const scrollOutputToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    outputEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  useEffect(() => {
    if (!outputOpen || !stickToBottom.current) return;
    scrollOutputToBottom();
  }, [logs, outputOpen, scrollOutputToBottom]);

  const handleOutputScroll = () => {
    const el = outputRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  const runsTable = useDataTable({
    data: runs,
    pageSize: 8,
    defaultSort: null,
    sortFns: {
      status: (a, b) => a.status.localeCompare(b.status),
      duration_ms: (a, b) => compareNumbers(a.duration_ms, b.duration_ms),
    },
  });

  const fetchLive = useCallback(async () => {
    if (!id) return { runs: [] as Run[], script: null as Script | null };
    const [s, r] = await Promise.all([
      api<Script>(`/api/v1/scripts/${id}`),
      api<Run[]>(`/api/v1/runs/scripts/${id}/runs`),
    ]);
    return { script: s, runs: r };
  }, [id]);

  const {
    data: liveData,
    reload: reloadLive,
    refreshing,
    lastUpdated,
  } = useLiveQuery(fetchLive, [id], { enabled: !!id });

  useEffect(() => {
    if (!liveData) return;
    setRuns(liveData.runs);
    setScript((prev) =>
      prev && liveData.script
        ? {
            ...prev,
            name: liveData.script.name,
            status: liveData.script.status,
            entrypoint: liveData.script.entrypoint,
          }
        : liveData.script,
    );
  }, [liveData]);

  const loadInitial = useCallback(async () => {
    if (!id) return;
    const s = await api<Script>(`/api/v1/scripts/${id}`);
    const f = await api<ScriptFile[]>(`/api/v1/scripts/${id}/files`);
    setScript(s);
    setFiles(f);
    const main = f.find((x) => x.path === s.entrypoint) ?? f[0];
    if (main) {
      setActiveFile(main.path);
      setContent(main.content ?? "");
    }
  }, [id]);

  useEffect(() => {
    loadInitial();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      attachedRunIdRef.current = null;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [loadInitial]);

  const fetchRunLogs = useCallback(async (runId: string) => {
    const logLines = await api<RunLog[]>(`/api/v1/runs/${runId}/logs`);
    setLogs(logLines.map((l) => l.message));
  }, []);

  const pollRunUntilDone = useCallback(
    (runId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const run = await api<Run>(`/api/v1/runs/${runId}`);
          await fetchRunLogs(runId);
          await reloadLive();
          if (TERMINAL_RUN_STATUSES.has(run.status)) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            attachedRunIdRef.current = null;
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          attachedRunIdRef.current = null;
        }
      }, 1500);
    },
    [fetchRunLogs, reloadLive],
  );

  const attachToRun = useCallback(
    (runId: string) => {
      if (attachedRunIdRef.current === runId) return;
      attachedRunIdRef.current = runId;

      wsRef.current?.close();
      const ws = new WebSocket(wsUrl(`/runs/${runId}`));
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data) as { message: string };
        setLogs((prev) => (prev.at(-1) === data.message ? prev : [...prev, data.message]));
      };

      void fetchRunLogs(runId);
      pollRunUntilDone(runId);
    },
    [fetchRunLogs, pollRunUntilDone],
  );

  const activeRun = runs.find((r) => ACTIVE_RUN_STATUSES.has(r.status));

  useEffect(() => {
    if (!activeRun) return;
    setOutputOpen(true);
    attachToRun(activeRun.id);
  }, [activeRun?.id, attachToRun]);

  const save = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api(`/api/v1/scripts/${id}/files/${activeFile}`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      });
      const check = await api<{ valid: boolean; error: string | null }>("/api/v1/editor/check", {
        method: "POST",
        body: JSON.stringify({ code: content }),
      });
      setSyntaxError(check.valid ? null : check.error);
      await reloadLive();
    } finally {
      setSaving(false);
    }
  };

  const runScript = async () => {
    if (!id || activeRun) return;
    stickToBottom.current = true;
    setLogs([]);
    setOutputOpen(true);
    try {
      const runRes = await api<Run>(`/api/v1/runs/scripts/${id}/run`, { method: "POST" });
      attachToRun(runRes.id);
      await reloadLive();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed");
    }
  };

  const stopScript = async () => {
    if (!id || !activeRun) return;
    try {
      await api(`/api/v1/runs/scripts/${id}/stop`, { method: "POST" });
      attachedRunIdRef.current = null;
      wsRef.current?.close();
      wsRef.current = null;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      await reloadLive();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Stop failed");
    }
  };

  const runTone = (st: string): "success" | "danger" | "warning" => {
    if (st === "success") return "success";
    if (st === "failed") return "danger";
    return "warning";
  };

  const selectFile = (path: string, fileContent: string | null) => {
    setActiveFile(path);
    setContent(fileContent ?? "");
  };

  const reloadFiles = useCallback(async () => {
    if (!id) return [] as ScriptFile[];
    const f = await api<ScriptFile[]>(`/api/v1/scripts/${id}/files`);
    setFiles(f);
    return f;
  }, [id]);

  const filePathUrl = (path: string) => encodeURIComponent(path).replace(/%2F/g, "/");

  const addFile = async (path: string) => {
    if (!id) return;
    try {
      const created = await api<ScriptFile>(`/api/v1/scripts/${id}/files`, {
        method: "POST",
        body: JSON.stringify({ path, content: "" }),
      });
      await reloadFiles();
      selectFile(created.path, created.content ?? "");
      toast.success(t("editor.fileAdded", { name: created.path }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("editor.fileAddFailed"));
      throw err;
    }
  };

  const deleteFile = async (path: string) => {
    if (!id) return;
    try {
      await api(`/api/v1/scripts/${id}/files/${filePathUrl(path)}`, { method: "DELETE" });
      const remaining = await reloadFiles();
      const next = remaining.find((f) => f.path === script?.entrypoint) ?? remaining[0];
      if (next) selectFile(next.path, next.content);
      toast.success(t("editor.fileDeleted", { name: path }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("editor.fileDeleteFailed"));
      throw err;
    }
  };

  const reorderFiles = async (paths: string[]) => {
    if (!id) return;
    await api(`/api/v1/scripts/${id}/files/order`, {
      method: "PUT",
      body: JSON.stringify({ paths }),
    });
    await reloadFiles();
  };

  const importFiles = async (imports: { path: string; content: string }[]) => {
    if (!id) return;
    for (const file of imports) {
      const exists = files.some((f) => f.path === file.path);
      if (exists) {
        await api(`/api/v1/scripts/${id}/files/${filePathUrl(file.path)}`, {
          method: "PUT",
          body: JSON.stringify({ content: file.content }),
        });
      } else {
        await api(`/api/v1/scripts/${id}/files`, {
          method: "POST",
          body: JSON.stringify({ path: file.path, content: file.content }),
        });
      }
    }
    const updated = await reloadFiles();
    const last = updated.find((f) => f.path === imports[imports.length - 1]?.path);
    if (last) selectFile(last.path, last.content);
    toast.success(t("editor.filesImported", { count: imports.length }));
  };

  if (!script) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-faint lg:h-screen">
        <ArrowPathIcon className="size-5 animate-spin" />
        <span className="ml-2 text-sm">{t("editor.loading")}</span>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden lg:h-screen">
      {/* Toolbar */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-overlay px-6 backdrop-blur-xl">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-faint">
            <span>{t("nav.scripts")}</span>
            <ChevronRightIcon className="size-3 shrink-0" />
            <span className="truncate text-muted">{script.name}</span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="truncate text-base font-semibold text-foreground">{script.name}</h1>
            <Badge label={script.status} tone={script.status === "enabled" ? "success" : "neutral"} />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <RefreshModeControl
            onRefresh={loadInitial}
            refreshing={refreshing}
            lastUpdated={lastUpdated}
            compact
          />
          {can(user, "scripts:write") && (
            <Button variant="secondary" size="sm" onClick={save} disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          )}
          {can(user, "scripts:run") && (
            <Button
              size="sm"
              variant={activeRun ? "secondary" : "primary"}
              onClick={activeRun ? stopScript : runScript}
              aria-label={activeRun ? t("common.stop") : t("common.run")}
              className="min-w-[9.5rem] justify-center"
            >
              <span className="inline-grid [&>*]:col-start-1 [&>*]:row-start-1 [&>*]:justify-self-center">
                <span
                  className={cn(
                    "inline-flex items-center gap-x-1.5",
                    activeRun && "invisible",
                  )}
                  aria-hidden={Boolean(activeRun)}
                >
                  <PlayIcon className="size-4 shrink-0" />
                  {t("common.run")}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-x-1.5",
                    !activeRun && "invisible",
                  )}
                  aria-hidden={!Boolean(activeRun)}
                >
                  <StopIcon className="size-4 shrink-0" />
                  {t("common.stop")}
                </span>
              </span>
            </Button>
          )}
        </div>
      </header>

      {syntaxError && (
        <div className="shrink-0 border-b border-red-500/20 bg-red-500/10 px-6 py-2.5 text-sm text-red-300">
          {syntaxError}
        </div>
      )}

      {/* Workspace — symmetric 3 columns */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_240px]">
        <ScriptFileExplorer
          files={files}
          activeFile={activeFile}
          entrypoint={script.entrypoint}
          search={search}
          onSearchChange={setSearch}
          canWrite={can(user, "scripts:write")}
          onSelectFile={selectFile}
          onAddFile={addFile}
          onDeleteFile={deleteFile}
          onReorderFiles={reorderFiles}
          onImportFiles={importFiles}
        />

        {/* Editor column */}
        <div className="flex min-w-0 flex-col">
          <div className={cn(SECTION_HEADER, "justify-between bg-surface-muted")}>
            <span className="truncate font-mono text-xs text-muted">{activeFile}</span>
            <span className="shrink-0 text-xs text-dim">Python</span>
          </div>

          <div className="min-h-0 flex-1">
            <Editor
              height="100%"
              language="python"
              theme={editorThemeName(resolved)}
              value={content}
              beforeMount={defineEditorTheme}
              onChange={(v) => setContent(v ?? "")}
              options={{
                readOnly: !can(user, "scripts:write"),
                minimap: { enabled: true, scale: 1 },
                fontSize: 13,
                fontFamily: "JetBrains Mono, monospace",
                fontLigatures: true,
                padding: { top: 16, bottom: 16 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                lineNumbersMinChars: 3,
                renderLineHighlight: "all",
                cursorBlinking: "smooth",
                bracketPairColorization: { enabled: true },
                guides: { indentation: true },
              }}
            />
          </div>

          {/* Output */}
          <div className="shrink-0 border-t border-line">
            <button
              type="button"
              onClick={() => setOutputOpen(!outputOpen)}
              className={cn(SECTION_HEADER, "w-full justify-between bg-panel-muted transition-colors hover:bg-surface")}
            >
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted">{t("editor.output")}</span>
              <span className="text-xs tabular-nums text-dim">{t("editor.lines", { count: logs.length })}</span>
            </button>
            {outputOpen && (
              <div
                ref={outputRef}
                onScroll={handleOutputScroll}
                className="h-40 overflow-y-auto bg-canvas px-4 py-3 font-mono text-xs leading-relaxed text-muted"
              >
                {logs.length ? (
                  logs.map((l, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">
                      {l}
                    </div>
                  ))
                ) : (
                  <span className="text-dim">{t("editor.outputEmpty")}</span>
                )}
                <div ref={outputEndRef} aria-hidden className="h-px shrink-0" />
              </div>
            )}
          </div>
        </div>

        {/* Run history */}
        <aside className="hidden flex-col border-l border-line bg-surface-muted lg:flex">
          <div className={cn(SECTION_HEADER, "justify-between")}>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-faint">{t("editor.runHistory")}</p>
            {runsTable.filteredCount > 0 && (
              <span className="text-xs tabular-nums text-dim">{runsTable.filteredCount}</span>
            )}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {runsTable.rows.map((r) => (
              <div key={r.id} className="rounded-lg bg-surface-muted p-3 ring-1 ring-ring-line">
                <Badge label={r.status} tone={runTone(r.status)} />
                <p className="mt-2 font-mono text-xs tabular-nums text-faint">
                  {r.duration_ms != null ? `${r.duration_ms} ms` : "—"}
                </p>
              </div>
            ))}
            {!runs.length && (
              <p className="px-1 py-4 text-center text-sm text-faint">{t("editor.noRuns")}</p>
            )}
          </div>
          {runsTable.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-3 py-2">
              <button
                type="button"
                disabled={runsTable.page <= 1}
                onClick={() => runsTable.setPage(runsTable.page - 1)}
                className="text-xs text-muted disabled:opacity-40 hover:text-foreground-secondary"
              >
                {t("table.previous")}
              </button>
              <span className="text-xs tabular-nums text-faint">
                {runsTable.page}/{runsTable.totalPages}
              </span>
              <button
                type="button"
                disabled={runsTable.page >= runsTable.totalPages}
                onClick={() => runsTable.setPage(runsTable.page + 1)}
                className="text-xs text-muted disabled:opacity-40 hover:text-foreground-secondary"
              >
                {t("table.next")}
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile tabs */}
      <div className="shrink-0 border-t border-line bg-panel-muted p-3 lg:hidden">
        <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-faint">{t("editor.files")}</p>
        {can(user, "scripts:write") && (
          <ScriptFileActions canWrite onAddFile={addFile} onImportFiles={importFiles}>
            {({ toolbar, form }) => (
              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-0.5">{toolbar}</div>
                {form}
              </div>
            )}
          </ScriptFileActions>
        )}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {files.map((f) => (
            <button
              key={f.path}
              type="button"
              onClick={() => selectFile(f.path, f.content)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 font-mono text-xs transition-colors",
                f.path === activeFile
                  ? "bg-cyan-400/10 text-cyan-400 ring-1 ring-inset ring-cyan-400/20"
                  : "bg-chip text-muted",
              )}
            >
              {f.path}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
