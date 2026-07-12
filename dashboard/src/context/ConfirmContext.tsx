import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocale } from '../i18n/LocaleContext';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(opts);
      setOpen(true);
    });
  }, []);

  const finish = useCallback((value: boolean) => {
    setOpen(false);
    setOptions(null);
    resolverRef.current?.(value);
    resolverRef.current = null;
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {open && options && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div
            className="w-full max-w-md rounded-t-panel border border-panel-border bg-panel-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-panel-lg dark:border-panel-border-dark dark:bg-panel-card-dark sm:rounded-panel sm:pb-5"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <h2 id="confirm-title" className="text-lg font-semibold text-panel-ink dark:text-panel-ink-dark">
              {options.title ?? t('common.confirmTitle')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-panel-muted dark:text-panel-muted-dark">
              {options.message}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => finish(false)}>
                {options.cancelLabel ?? t('common.cancel')}
              </button>
              <button
                type="button"
                className={options.variant === 'danger' ? 'btn-danger' : 'btn-primary'}
                onClick={() => finish(true)}
              >
                {options.confirmLabel ?? t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm requires ConfirmProvider');
  return ctx;
}
