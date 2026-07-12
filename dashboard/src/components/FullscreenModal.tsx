import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function FullscreenModal({
  open,
  onClose,
  title,
  children,
  ariaLabelClose,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  ariaLabelClose: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex h-[100dvh] min-h-[100dvh] flex-col bg-panel-canvas dark:bg-panel-canvas-dark"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-panel-border bg-panel-surface px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-panel-border-dark dark:bg-panel-bg-dark sm:px-6">
        <h1 className="text-lg font-semibold tracking-tight text-panel-ink dark:text-panel-ink-dark sm:text-xl">
          {title}
        </h1>
        <button
          type="button"
          onClick={onClose}
          className="btn-icon rounded-full"
          aria-label={ariaLabelClose}
          title={ariaLabelClose}
        >
          <X size={22} strokeWidth={2} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
