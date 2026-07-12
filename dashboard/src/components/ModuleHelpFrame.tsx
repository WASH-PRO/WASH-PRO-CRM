import { useLocale } from '../i18n/LocaleContext';
import { moduleHelpUrl } from '../api/modules';

export function ModuleHelpFrame({ moduleId, className }: { moduleId: string; className?: string }) {
  const { t, locale } = useLocale();

  return (
    <iframe
      title={t('pages.modules.helpTitle', { name: moduleId })}
      src={moduleHelpUrl(moduleId, locale)}
      className={className ?? 'panel-card min-h-[420px] w-full flex-1'}
      sandbox="allow-same-origin"
    />
  );
}
