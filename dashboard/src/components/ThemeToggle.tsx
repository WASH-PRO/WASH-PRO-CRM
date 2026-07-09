import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeMode } from '../context/ThemeContext';
import { useLocale } from '../i18n/LocaleContext';

const ICONS = { light: Sun, dark: Moon, system: Monitor };

export function ThemeToggle({ className }: { className?: string }) {
  const { themeMode, cycleTheme } = useTheme();
  const { t } = useLocale();
  const Icon = ICONS[themeMode];
  const labels: Record<ThemeMode, string> = {
    light: t('theme.light'),
    dark: t('theme.dark'),
    system: t('theme.system'),
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={className ?? 'btn-icon'}
      title={labels[themeMode]}
    >
      <Icon size={18} />
    </button>
  );
}
