import { ArrowUpTrayIcon, PlusIcon } from "@heroicons/react/20/solid";
import { useRef, useState, type ReactNode } from "react";
import { IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTranslation } from "@/context/LocaleContext";

interface ScriptFileActionsProps {
  canWrite: boolean;
  disabled?: boolean;
  onAddFile: (path: string) => Promise<void>;
  onImportFiles: (files: { path: string; content: string }[]) => Promise<void>;
  children: (parts: { toolbar: ReactNode; form: ReactNode | null }) => ReactNode;
}

export default function ScriptFileActions({
  canWrite,
  disabled = false,
  onAddFile,
  onImportFiles,
  children,
}: ScriptFileActionsProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [busy, setBusy] = useState(false);

  const isBusy = disabled || busy;

  const submitNewFile = async () => {
    const path = newPath.trim();
    if (!path) return;
    setBusy(true);
    try {
      await onAddFile(path);
      setNewPath("");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  const handleFilePick = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!canWrite) {
    return children({ toolbar: null, form: null });
  }

  const toolbar = (
    <>
      <IconButton
        aria-label={t("editor.addFile")}
        disabled={isBusy}
        onClick={() => setAdding((v) => !v)}
      >
        <PlusIcon className="size-4" />
      </IconButton>
      <IconButton
        aria-label={t("editor.importFromDisk")}
        disabled={isBusy}
        onClick={() => fileInputRef.current?.click()}
      >
        <ArrowUpTrayIcon className="size-4" />
      </IconButton>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void handleFilePick(e.target.files)}
      />
    </>
  );

  const form = adding ? (
    <form
      className="flex gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        void submitNewFile();
      }}
    >
      <Input
        className="h-8 font-mono text-xs"
        placeholder={t("editor.newFilePlaceholder")}
        value={newPath}
        autoFocus
        disabled={isBusy}
        onChange={(e) => setNewPath(e.target.value)}
      />
    </form>
  ) : null;

  return children({ toolbar, form });
}
