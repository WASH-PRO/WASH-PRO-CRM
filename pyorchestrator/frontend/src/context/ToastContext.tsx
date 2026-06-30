import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "@/context/LocaleContext";
import { cn } from "@/lib/cn";

export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TOAST_DURATION_MS = 4500;

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const className = cn(
    "size-5 shrink-0",
    variant === "success" && "text-emerald-400",
    variant === "error" && "text-red-400",
    variant === "info" && "text-cyan-400",
  );

  if (variant === "success") return <CheckCircleIcon className={className} aria-hidden />;
  if (variant === "error") return <ExclamationCircleIcon className={className} aria-hidden />;
  return <InformationCircleIcon className={className} aria-hidden />;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const { t } = useTranslation();

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-end gap-2 p-4 sm:p-6"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 shadow-lg ring-1 ring-inset backdrop-blur-xl animate-in slide-in-from-bottom-2 fade-in duration-200",
            toast.variant === "success" && "bg-emerald-500/10 text-emerald-100 ring-emerald-500/25",
            toast.variant === "error" && "bg-red-500/10 text-red-100 ring-red-500/25",
            toast.variant === "info" && "bg-cyan-400/10 text-cyan-100 ring-cyan-400/25",
          )}
        >
          <ToastIcon variant={toast.variant} />
          <p className="min-w-0 flex-1 pt-0.5 text-sm leading-snug text-foreground-secondary">{toast.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 rounded-md p-1 text-faint transition-colors hover:bg-hover hover:text-foreground-secondary"
            aria-label={t("common.close")}
          >
            <XMarkIcon className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev.slice(-4), { id, message, variant }]);
      window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  const toast = useMemo<ToastApi>(
    () => ({
      success: (message) => push(message, "success"),
      error: (message) => push(message, "error"),
      info: (message) => push(message, "info"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
