import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ExternalLink, Search } from 'lucide-react';
import { FullscreenModal } from './FullscreenModal';
import { HelpScreenMockup, HELP_MOCKUPS } from './HelpScreenMockup';
import { ModuleHelpFrame } from './ModuleHelpFrame';
import { HELP_SECTIONS, type HelpMockupId } from '../help/sections';
import { listModuleCatalog, type CatalogModule } from '../api/modules';
import { useLocale } from '../i18n/LocaleContext';
import { useAuth } from '../context/AuthContext';

const DOCS_BASE = 'https://wash-pro.github.io/WASH-PRO-CRM';

interface DynamicHelpSection {
  id: string;
  groupKey: string;
  mockup: HelpMockupId;
  adminOnly?: boolean;
  moduleName?: string;
}

export function resolveHelpSectionId(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  const moduleId = path.match(/^\/modules\/([^/]+)/)?.[1];
  if (moduleId) return `module:${moduleId}`;

  const staticMap: Record<string, string> = {
    '/': 'dashboard',
    '/states': 'states',
    '/washes': 'washes',
    '/posts': 'posts',
    '/mqtt': 'mqtt',
    '/usage': 'usage',
    '/finance': 'finance',
    '/archive': 'archive',
    '/system': 'system',
    '/notifications': 'notifications',
    '/settings': 'settings',
    '/modules': 'modules',
    '/telegram': 'telegram',
    '/mcp': 'mcp',
    '/backups': 'backups',
    '/info-messages': 'infoMessages',
    '/work-modes': 'workModes',
    '/currency': 'currency',
    '/discount-types': 'discountTypes',
    '/users': 'users',
    '/groups': 'groups',
    '/logs': 'logs',
  };

  if (staticMap[path]) return staticMap[path];
  if (path.startsWith('/posts/')) return 'postDetail';
  if (path.startsWith('/cards/')) {
    if (path.includes('/service')) return 'cardsService';
    if (path.includes('/vip')) return 'cardsVip';
    if (path.includes('/collection')) return 'cardsCollection';
    return 'cardsDiscount';
  }
  return 'dashboard';
}

export function HelpModal({
  open,
  onClose,
  initialSectionId,
}: {
  open: boolean;
  onClose: () => void;
  initialSectionId?: string;
}) {
  const { t, locale } = useLocale();
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState('dashboard');
  const [catalog, setCatalog] = useState<CatalogModule[]>([]);

  useEffect(() => {
    if (open && initialSectionId) {
      setActiveId(initialSectionId);
    }
  }, [open, initialSectionId]);

  useEffect(() => {
    if (!open || !isAdmin) {
      setCatalog([]);
      return;
    }
    void listModuleCatalog()
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, [open, isAdmin]);

  const moduleSections: DynamicHelpSection[] = useMemo(
    () =>
      catalog.map((m) => ({
        id: `module:${m.id}`,
        groupKey: 'moduleHelp',
        mockup: 'settings',
        adminOnly: true,
        moduleName: locale === 'en' ? m.name.en : m.name.ru,
      })),
    [catalog, locale]
  );

  const sections = useMemo(() => {
    const base = HELP_SECTIONS.filter((s) => !s.adminOnly || isAdmin);
    return [...base, ...moduleSections.filter((s) => !s.adminOnly || isAdmin)];
  }, [isAdmin, moduleSections]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) => {
      if (s.id.startsWith('module:')) {
        const name = (s as DynamicHelpSection).moduleName?.toLowerCase() ?? '';
        return name.includes(q) || s.id.toLowerCase().includes(q);
      }
      const title = t(`help.sections.${s.id}.title`).toLowerCase();
      const summary = t(`help.sections.${s.id}.summary`).toLowerCase();
      return title.includes(q) || summary.includes(q);
    });
  }, [query, sections, t]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof sections>();
    for (const s of filtered) {
      const g =
        s.groupKey === 'moduleHelp'
          ? t('nav.groups.moduleHelp')
          : t(`nav.groups.${s.groupKey}`);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }
    return [...map.entries()];
  }, [filtered, t]);

  const active = sections.find((s) => s.id === activeId) ?? sections[0];
  const sectionId = active?.id ?? 'dashboard';
  const isModuleHelp = sectionId.startsWith('module:');
  const moduleId = isModuleHelp ? sectionId.slice('module:'.length) : '';
  const mockup: HelpMockupId = active?.mockup ?? 'dashboard';

  const regionLabels = useMemo(() => {
    if (isModuleHelp) return {};
    const ids = HELP_MOCKUPS[mockup].map((r) => r.id);
    return Object.fromEntries(
      ids.map((id) => [id, t(`help.sections.${sectionId}.regions.${id}`)])
    );
  }, [isModuleHelp, mockup, sectionId, t]);

  const sectionTitle = isModuleHelp
    ? ((active as DynamicHelpSection).moduleName ?? moduleId)
    : t(`help.sections.${sectionId}.title`);

  return (
    <FullscreenModal open={open} onClose={onClose} title={t('help.title')} ariaLabelClose={t('help.close')}>
      <div className="flex h-full min-h-0 flex-col lg:flex-row">
        <aside className="flex shrink-0 flex-col border-b border-panel-border dark:border-panel-border-dark lg:w-72 lg:border-b-0 lg:border-r">
          <div className="p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-panel-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('help.searchPlaceholder')}
                className="field-input w-full pl-9 text-sm"
              />
            </div>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 lg:max-h-none">
            {grouped.map(([groupTitle, items]) => (
              <div key={groupTitle} className="mb-3">
                <div className="nav-group-title px-2">{groupTitle}</div>
                <ul className="space-y-0.5">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(item.id)}
                        className={clsx(
                          'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                          item.id === sectionId
                            ? 'bg-brand-500/15 font-medium text-brand-800 dark:text-brand-200'
                            : 'text-panel-ink hover:bg-panel-canvas dark:text-panel-ink-dark dark:hover:bg-white/5'
                        )}
                      >
                        {item.id.startsWith('module:')
                          ? (item as DynamicHelpSection).moduleName
                          : t(`help.sections.${item.id}.title`)}
                        {item.adminOnly && (
                          <span className="ml-1 text-[10px] uppercase text-panel-muted">({t('help.adminBadge')})</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="shrink-0 border-t border-panel-border p-3 dark:border-panel-border-dark">
            <a
              href={`${DOCS_BASE}/${locale}/modules/`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary btn-sm w-full justify-center"
            >
              <ExternalLink size={14} /> {t('help.docsModulesLink')}
            </a>
          </div>
        </aside>

        <article className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-panel-ink dark:text-panel-ink-dark">
            {sectionTitle}
          </h2>

          {isModuleHelp ? (
            <>
              <p className="mt-3 text-base leading-relaxed text-panel-muted dark:text-panel-muted-dark">
                {t('help.moduleHelpIntro')}
              </p>
              <section className="mt-6">
                <ModuleHelpFrame moduleId={moduleId} className="panel-card min-h-[min(70vh,640px)] w-full" />
              </section>
            </>
          ) : (
            <>
              <p className="mt-3 text-base leading-relaxed text-panel-muted dark:text-panel-muted-dark">
                {t(`help.sections.${sectionId}.summary`)}
              </p>

              <section className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                  {t('help.onScreen')}
                </h3>
                <div className="mt-3 max-w-2xl">
                  <HelpScreenMockup mockup={mockup} regionLabels={regionLabels} />
                </div>
              </section>

              <section className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                  {t('help.howItWorks')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-panel-ink dark:text-panel-ink-dark">
                  {t(`help.sections.${sectionId}.howItWorks`)}
                </p>
              </section>

              <section className="mt-6 rounded-lg border border-brand-500/20 bg-brand-500/5 p-4 dark:border-brand-400/20 dark:bg-brand-400/10">
                <h3 className="text-sm font-semibold text-brand-900 dark:text-brand-100">{t('help.example')}</h3>
                <p className="mt-2 text-sm leading-relaxed text-panel-ink dark:text-panel-ink-dark">
                  {t(`help.sections.${sectionId}.example`)}
                </p>
              </section>
            </>
          )}
        </article>
      </div>
    </FullscreenModal>
  );
}
