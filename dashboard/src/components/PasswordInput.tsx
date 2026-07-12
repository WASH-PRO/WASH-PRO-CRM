import { InputHTMLAttributes, useState } from 'react';
import clsx from 'clsx';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../i18n/LocaleContext';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Override admin-only reveal; default uses isAdmin from auth */
  allowReveal?: boolean;
};

export function PasswordInput({ className, allowReveal, disabled, readOnly, ...rest }: PasswordInputProps) {
  const { isAdmin } = useAuth();
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const canReveal = allowReveal ?? isAdmin;

  if (!canReveal) {
    return (
      <input
        type="password"
        className={clsx('input', className)}
        disabled={disabled}
        readOnly={readOnly}
        {...rest}
      />
    );
  }

  const toggleLabel = visible ? t('common.hidePassword') : t('common.showPassword');

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className={clsx('input pr-10', className)}
        disabled={disabled}
        readOnly={readOnly}
        {...rest}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-panel-muted transition-colors hover:text-panel-ink disabled:pointer-events-none disabled:opacity-40 dark:text-panel-muted-dark dark:hover:text-panel-ink-dark"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled || readOnly}
        aria-label={toggleLabel}
        title={toggleLabel}
      >
        {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
      </button>
    </div>
  );
}
