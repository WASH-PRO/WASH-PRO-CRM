import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeMode } from '../context/ThemeContext';

const LABELS: Record<ThemeMode, string> = {
  light: 'Светлая тема',
  dark: 'Тёмная тема',
  system: 'Системная тема',
};

const ICONS = { light: Sun, dark: Moon, system: Monitor };

export function ThemeToggle({ className }: { className?: string }) {
  const { themeMode, cycleTheme } = useTheme();
  const Icon = ICONS[themeMode];

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={className ?? 'btn-icon'}
      title={LABELS[themeMode]}
    >
      <Icon size={18} />
    </button>
  );
}
