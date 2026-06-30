import {
  Bars3Icon,
  DocumentIcon,
  TrashIcon,
} from "@heroicons/react/20/solid";
import { useMemo, useState, type DragEvent } from "react";
import { Input } from "@/components/ui/Input";
import { IconButton } from "@/components/ui/Button";
import ScriptFileActions from "@/components/editor/ScriptFileActions";
import { cn } from "@/lib/cn";
import { useTranslation } from "@/context/LocaleContext";

export interface ExplorerFile {
  path: string;
  content: string | null;
}

interface ScriptFileExplorerProps {
  files: ExplorerFile[];
  activeFile: string;
  entrypoint: string;
  search: string;
  onSearchChange: (value: string) => void;
  canWrite: boolean;
  onSelectFile: (path: string, content: string | null) => void;
  onAddFile: (path: string) => Promise<void>;
  onDeleteFile: (path: string) => Promise<void>;
  onReorderFiles: (paths: string[]) => Promise<void>;
  onImportFiles: (files: { path: string; content: string }[]) => Promise<void>;
}

const SECTION_HEADER = "flex h-11 shrink-0 items-center border-b border-line px-4";

function reorderPaths(paths: string[], dragged: string, target: string): string[] {
  if (dragged === target) return paths;
  const next = paths.filter((p) => p !== dragged);
  const targetIndex = next.indexOf(target);
  if (targetIndex < 0) return paths;
  next.splice(targetIndex, 0, dragged);
  return next;
}

export default function ScriptFileExplorer({
  files,
  activeFile,
  entrypoint,
  search,
  onSearchChange,
  canWrite,
  onSelectFile,
  onAddFile,
  onDeleteFile,
  onReorderFiles,
  onImportFiles,
}: ScriptFileExplorerProps) {
  const { t } = useTranslation();
  const [dragPath, setDragPath] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [externalDrag, setExternalDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  const paths = useMemo(() => files.map((f) => f.path), [files]);
  const filtered = useMemo(
    () => files.filter((f) => !search || f.path.toLowerCase().includes(search.toLowerCase())),
    [files, search],
  );

  const canDeleteActive =
    canWrite &&
    files.length > 1 &&
    activeFile !== entrypoint &&
    activeFile !== entrypoint.replace(/\\/g, "/");

  const submitNewFile = async (path: string) => {
    setBusy(true);
    try {
      await onAddFile(path);
    } finally {
      setBusy(false);
    }
  };

  const handleImportFiles = async (imports: { path: string; content: string }[]) => {
    setBusy(true);
    try {
      await onImportFiles(imports);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!canDeleteActive) return;
    if (!window.confirm(t("editor.confirmDeleteFile", { name: activeFile }))) return;
    setBusy(true);
    try {
      await onDeleteFile(activeFile);
    } finally {
      setBusy(false);
    }
  };

  const handleInternalDrop = async (targetPath: string) => {
    if (!dragPath || !canWrite) return;
    const next = reorderPaths(paths, dragPath, targetPath);
    setDragPath(null);
    setDropTarget(null);
    if (next.join("|") === paths.join("|")) return;
    setBusy(true);
    try {
      await onReorderFiles(next);
    } finally {
      setBusy(false);
    }
  };

  const readDroppedFiles = async (fileList: FileList) => {
    const imports: { path: string; content: string }[] = [];
    for (const file of Array.from(fileList)) {
      const path = file.name.replace(/\\/g, "/").replace(/^\/+/, "");
      if (!path || path.includes("..")) continue;
      const content = await file.text();
      imports.push({ path, content });
    }
    if (!imports.length) return;
    setBusy(true);
    try {
      await onImportFiles(imports);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside
      className={cn(
        "hidden flex-col border-r border-line bg-surface-muted lg:flex",
        externalDrag && "ring-2 ring-inset ring-cyan-400/30",
      )}
      onDragEnter={(e) => {
        if (!canWrite || e.dataTransfer.types.includes("Files")) setExternalDrag(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setExternalDrag(false);
      }}
      onDragOver={(e) => {
        if (canWrite && e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        setExternalDrag(false);
        if (!canWrite || !e.dataTransfer.files.length) return;
        e.preventDefault();
        void readDroppedFiles(e.dataTransfer.files);
      }}
    >
      <div className={cn(SECTION_HEADER, "flex-col items-stretch justify-center gap-2 py-3 !h-auto")}>
        <ScriptFileActions
          canWrite={canWrite}
          disabled={busy}
          onAddFile={submitNewFile}
          onImportFiles={handleImportFiles}
        >
          {({ toolbar, form }) => (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-faint">
                  {t("editor.explorer")}
                </p>
                {canWrite && (
                  <div className="flex items-center gap-0.5">
                    {toolbar}
                    <IconButton
                      aria-label={t("editor.deleteFile")}
                      disabled={busy || !canDeleteActive}
                      onClick={() => void handleDelete()}
                      className="hover:text-red-400 disabled:hover:text-muted"
                      title={
                        !canDeleteActive && activeFile === entrypoint
                          ? t("editor.cannotDeleteEntrypoint")
                          : files.length <= 1
                            ? t("editor.cannotDeleteOnlyFile")
                            : undefined
                      }
                    >
                      <TrashIcon className="size-4" />
                    </IconButton>
                  </div>
                )}
              </div>
              {form}
            </>
          )}
        </ScriptFileActions>
        <div className="relative">
          <Input
            className="h-8 text-xs"
            placeholder={t("editor.filterFiles")}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {filtered.map((f) => {
          const isEntrypoint = f.path === entrypoint;
          const isDropTarget = dropTarget === f.path && dragPath !== f.path;
          return (
            <div
              key={f.path}
              draggable={canWrite && !search}
              onDragStart={(e: DragEvent) => {
                if (search) return;
                setDragPath(f.path);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", f.path);
              }}
              onDragEnd={() => {
                setDragPath(null);
                setDropTarget(null);
              }}
              onDragOver={(e) => {
                if (!dragPath || dragPath === f.path) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDropTarget(f.path);
              }}
              onDragLeave={() => {
                if (dropTarget === f.path) setDropTarget(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleInternalDrop(f.path);
              }}
              className={cn(
                "flex items-center gap-1 rounded-md transition-colors",
                isDropTarget && "bg-cyan-400/10 ring-1 ring-inset ring-cyan-400/20",
                dragPath === f.path && "opacity-50",
              )}
            >
              {canWrite && !search && (
                <span className="cursor-grab pl-1 text-faint active:cursor-grabbing">
                  <Bars3Icon className="size-3.5" />
                </span>
              )}
              <button
                type="button"
                onClick={() => onSelectFile(f.path, f.content)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left transition-colors",
                  f.path === activeFile
                    ? "bg-cyan-400/10 text-cyan-400 ring-1 ring-inset ring-cyan-400/20"
                    : "text-muted hover:bg-inset hover:text-foreground-secondary",
                )}
              >
                <DocumentIcon className="size-4 shrink-0 opacity-60" />
                <span className="truncate font-mono text-xs">{f.path}</span>
                {isEntrypoint && (
                  <span className="ml-auto shrink-0 rounded px-1 py-0.5 text-[10px] uppercase text-cyan-400/80 ring-1 ring-cyan-400/20">
                    {t("editor.entrypoint")}
                  </span>
                )}
              </button>
            </div>
          );
        })}
        {!filtered.length && (
          <p className="px-2 py-4 text-center text-xs text-faint">{t("editor.noFilesMatch")}</p>
        )}
      </nav>

      {externalDrag && canWrite && (
        <div className="border-t border-line bg-cyan-400/5 px-4 py-3 text-center text-xs text-cyan-300">
          {t("editor.dropFilesHint")}
        </div>
      )}
    </aside>
  );
}
