import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Download,
  ExternalLink,
  Play,
  RefreshCw,
  Search,
  Settings,
  Square,
  Trash2,
} from 'lucide-react';
import {
  checkModulesBridgeHealth,
  installModule,
  listModuleCatalog,
  startModule,
  stopModule,
  uninstallModule,
  updateModule,
  type CatalogModule,
} from '../api/modules';
import { Badge, Empty, ErrorMessage, Loading, PageHeader } from '../components/UI';
import { ModuleHelpFrame } from '../components/ModuleHelpFrame';
import { ModuleSettingsFrame } from '../components/ModuleSettingsFrame';
import { useBreadcrumbLastLabel } from '../context/BreadcrumbContext';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { useLocale } from '../i18n/LocaleContext';

type PageState = 'loading' | 'ready' | 'unavailable';
type InstallFilter = 'all' | 'installed' | 'available';
type StatusFilter = 'all' | 'running' | 'stopped' | 'error' | 'updating' | 'catalog';

const MODULE_PAGE_SIZE_OPTIONS = [4, 8, 12, 24];
const DEFAULT_MODULE_PAGE_SIZE = 4;

function localized(text: { ru: string; en: string }, locale: string): string {
  return locale === 'en' ? text.en : text.ru;
}

function moduleSearchHaystack(module: CatalogModule, locale: string): string {
  return [
    module.id,
    localized(module.name, locale),
    localized(module.description, locale),
    module.author,
    module.category,
    module.repository,
    module.license,
  ]
    .join(' ')
    .toLowerCase();
}

function moduleStatusFilterKey(module: CatalogModule): StatusFilter {
  if (!module.installed) return 'catalog';
  if (module.activeRunStatus === 'running' || module.installState === 'running') return 'running';
  if (module.installState === 'updating' || module.activeRunStatus === 'queued') return 'updating';
  if (module.installState === 'error') return 'error';
  return 'stopped';
}

function statusBadge(
  module: CatalogModule,
  t: (key: string) => string
): { label: string; variant: 'success' | 'warning' | 'default' | 'error' } {
  if (!module.installed) {
    return { label: t('pages.modules.statusAvailable'), variant: 'default' };
  }
  if (module.activeRunStatus === 'running' || module.installState === 'running') {
    return { label: t('status.started'), variant: 'success' };
  }
  if (module.activeRunStatus === 'queued' || module.installState === 'updating') {
    return { label: t('pages.modules.statusUpdating'), variant: 'warning' };
  }
  if (module.installState === 'error') {
    return { label: t('status.error'), variant: 'error' };
  }
  return { label: t('status.stopped'), variant: 'default' };
}

function ModuleCard({
  module,
  locale,
  busy,
  onInstall,
  onStart,
  onStop,
  onUpdate,
  onUninstall,
}: {
  module: CatalogModule;
  locale: string;
  busy: string | null;
  onInstall: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onUpdate: (id: string) => void;
  onUninstall: (id: string) => void;
}) {
  const { t } = useLocale();
  const name = localized(module.name, locale);
  const description = localized(module.description, locale);
  const badge = statusBadge(module, t);
  const isBusy = busy === module.id;

  return (
    <article className="panel-card flex flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <Link
          to={`/modules/${module.id}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-panel-canvas transition-colors hover:ring-2 hover:ring-brand-500/30 dark:bg-panel-sidebar-hover"
          title={name}
        >
          {module.iconUrl ? (
            <img src={module.iconUrl} alt="" className="h-10 w-10 object-contain" />
          ) : (
            <span className="text-lg font-semibold text-panel-muted dark:text-panel-muted-dark">{name.charAt(0)}</span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate text-base font-semibold">
              <Link
                to={`/modules/${module.id}`}
                className="text-panel-ink transition-colors hover:text-brand-600 dark:text-panel-ink-dark dark:hover:text-brand-400"
                title={name}
              >
                {name}
              </Link>
            </h3>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="mt-1 text-xs text-panel-muted dark:text-panel-muted-dark">
            v{module.installed ? module.installedVersion ?? module.version : module.version} · {module.author} ·{' '}
            {module.license}
          </p>
        </div>
      </div>

      <p className="mb-3 flex-1 text-sm text-panel-muted line-clamp-3 dark:text-panel-muted-dark">{description}</p>

      <div className="mb-4 flex flex-wrap gap-1.5 text-xs text-panel-muted dark:text-panel-muted-dark">
        <span className="rounded-md bg-panel-canvas px-2 py-0.5 dark:bg-panel-sidebar-hover">{module.category}</span>
        {module.dependencies?.length ? (
          <span className="rounded-md bg-panel-canvas px-2 py-0.5 dark:bg-panel-sidebar-hover">
            {t('pages.modules.deps')}: {module.dependencies.join(', ')}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap gap-1.5 border-t border-panel-border pt-3 dark:border-panel-border-dark">
        {!module.installed ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onInstall(module.id)}
            className="btn-icon bg-brand-600 text-white hover:bg-brand-500 dark:bg-brand-500 dark:hover:bg-brand-400"
            title={t('pages.modules.install')}
            aria-label={t('pages.modules.install')}
          >
            <Download size={16} aria-hidden />
          </button>
        ) : (
          <>
            {module.activeRunStatus === 'running' || module.installState === 'running' ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onStop(module.id)}
                className="btn-icon text-amber-600 dark:text-amber-400"
                title={t('pages.modules.stop')}
                aria-label={t('pages.modules.stop')}
              >
                <Square size={16} aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onStart(module.id)}
                className="btn-icon bg-brand-600 text-white hover:bg-brand-500 dark:bg-brand-500 dark:hover:bg-brand-400"
                title={t('pages.modules.start')}
                aria-label={t('pages.modules.start')}
              >
                <Play size={16} aria-hidden />
              </button>
            )}
            <Link
              to={`/modules/${module.id}`}
              className="btn-icon"
              title={t('pages.modules.settings')}
              aria-label={t('pages.modules.settings')}
            >
              <Settings size={16} aria-hidden />
            </Link>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onUpdate(module.id)}
              className="btn-icon"
              title={t('pages.modules.update')}
              aria-label={t('pages.modules.update')}
            >
              <RefreshCw size={16} className={isBusy ? 'animate-spin' : ''} aria-hidden />
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onUninstall(module.id)}
              className="btn-icon text-red-500 hover:border-red-500/30 hover:text-red-600 dark:hover:text-red-400"
              title={t('pages.modules.uninstall')}
              aria-label={t('pages.modules.uninstall')}
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </>
        )}
        {module.repository ? (
          <a
            href={`https://github.com/${module.repository.replace(/^https:\/\/github.com\//, '')}`}
            target="_blank"
            rel="noreferrer"
            className="btn-icon"
            title="GitHub"
            aria-label="GitHub"
          >
            <ExternalLink size={16} aria-hidden />
          </a>
        ) : null}
        <Link
          to={`/modules/${module.id}?tab=help`}
          className="btn-icon"
          title={t('pages.modules.help')}
          aria-label={t('pages.modules.help')}
        >
          <BookOpen size={16} aria-hidden />
        </Link>
      </div>
    </article>
  );
}

function ModuleCatalogToolbar({
  search,
  onSearchChange,
  installFilter,
  onInstallFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  statusFilter,
  onStatusFilterChange,
  categories,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  installFilter: InstallFilter;
  onInstallFilterChange: (value: InstallFilter) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  categories: string[];
}) {
  const { t } = useLocale();

  return (
    <div className="data-toolbar mb-6">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-stretch md:gap-4">
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center md:w-auto md:flex-1">
          <div className="search-field md:max-w-md">
            <Search size={16} className="search-field-icon" />
            <input
              className="input-search"
              placeholder={t('pages.modules.searchPlaceholder')}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
        <div className="min-w-0">
          <label className="label !mb-1">{t('pages.modules.filterInstall')}</label>
          <select
            className="input input-sm"
            value={installFilter}
            onChange={(e) => onInstallFilterChange(e.target.value as InstallFilter)}
          >
            <option value="all">{t('common.all')}</option>
            <option value="installed">{t('pages.modules.installedSection')}</option>
            <option value="available">{t('pages.modules.availableSection')}</option>
          </select>
        </div>
        <div className="min-w-0">
          <label className="label !mb-1">{t('pages.modules.filterStatus')}</label>
          <select
            className="input input-sm"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
          >
            <option value="all">{t('common.all')}</option>
            <option value="catalog">{t('pages.modules.statusAvailable')}</option>
            <option value="running">{t('status.started')}</option>
            <option value="stopped">{t('status.stopped')}</option>
            <option value="updating">{t('pages.modules.statusUpdating')}</option>
            <option value="error">{t('status.error')}</option>
          </select>
        </div>
        <div className="min-w-0">
          <label className="label !mb-1">{t('pages.modules.filterCategory')}</label>
          <select
            className="input input-sm"
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
          >
            <option value="">{t('common.all')}</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function ModuleCatalogFooter({
  total,
  page,
  totalPages,
  pageSize,
  effectiveLoaded,
  canLoadMore,
  onPageSizeChange,
  onPrev,
  onNext,
  onLoadMore,
}: {
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
  effectiveLoaded: number;
  canLoadMore: boolean;
  onPageSizeChange: (size: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onLoadMore: () => void;
}) {
  const { t } = useLocale();
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="table-footer mt-4">
      <div className="flex flex-col gap-1">
        <span>
          {t('pages.modules.resultsCount', { count: total })}
          {totalPages > 1 ? ` · ${t('dataTable.pageOf', { page, total: totalPages })}` : null}
          {canLoadMore ? ` · ${t('dataTable.loadedCount', { count: effectiveLoaded })}` : null}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-panel-muted dark:text-panel-muted-dark">
          <span>{t('dataTable.perPage')}</span>
          <select
            className="input input-sm w-auto"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label={t('dataTable.perPageAria')}
          >
            {MODULE_PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-secondary btn-sm" disabled={!hasPrev} onClick={onPrev}>
          {t('dataTable.prev')}
        </button>
        <button type="button" className="btn-secondary btn-sm" disabled={!hasNext} onClick={onNext}>
          {t('dataTable.next')}
        </button>
        {canLoadMore ? (
          <button type="button" className="btn-secondary btn-sm" onClick={onLoadMore}>
            {t('dataTable.loadMore', { count: Math.min(pageSize, total - effectiveLoaded) })}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ModulesPage() {
  const { t, locale } = useLocale();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogModule[]>([]);
  const [pyorchAvailable, setPyorchAvailable] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [installFilter, setInstallFilter] = useState<InstallFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_MODULE_PAGE_SIZE);
  const [loadedCount, setLoadedCount] = useState(DEFAULT_MODULE_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
    setLoadedCount(pageSize);
  }, [search, installFilter, statusFilter, categoryFilter, pageSize]);

  const load = useCallback(async (refresh = false) => {
    try {
      const health = await checkModulesBridgeHealth();
      setPyorchAvailable(health.pyorchAvailable);
      const data = await listModuleCatalog(refresh);
      setCatalog(data);
      setServiceError(null);
      setPageState('ready');
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : t('pages.modules.unavailable'));
      setPageState('unavailable');
    }
  }, [t]);

  usePolling(() => load(false), [], { intervalMs: LIVE_INTERVAL_SLOW_MS, enabled: pageState === 'ready' });

  useEffect(() => {
    void load(false);
  }, [load]);

  const runAction = async (id: string, action: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await action();
      await load(false);
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : t('pages.modules.actionFailed'));
    } finally {
      setBusy(null);
    }
  };

  const categories = useMemo(
    () => [...new Set(catalog.map((m) => m.category).filter(Boolean))].sort(),
    [catalog]
  );

  const filteredModules = useMemo(() => {
    const query = search.trim().toLowerCase();
    return catalog
      .filter((module) => {
        if (installFilter === 'installed' && !module.installed) return false;
        if (installFilter === 'available' && module.installed) return false;
        if (categoryFilter && module.category !== categoryFilter) return false;
        if (statusFilter !== 'all' && moduleStatusFilterKey(module) !== statusFilter) return false;
        if (query && !moduleSearchHaystack(module, locale).includes(query)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.installed !== b.installed) return a.installed ? -1 : 1;
        return localized(a.name, locale).localeCompare(localized(b.name, locale), locale);
      });
  }, [catalog, search, installFilter, categoryFilter, statusFilter, locale]);

  const effectiveLoaded = Math.min(loadedCount, filteredModules.length);
  const totalPages = Math.max(1, Math.ceil(effectiveLoaded / pageSize));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const visibleModules = useMemo(
    () =>
      filteredModules.slice(
        (currentPage - 1) * pageSize,
        Math.min(currentPage * pageSize, effectiveLoaded)
      ),
    [filteredModules, currentPage, pageSize, effectiveLoaded]
  );
  const canLoadMore = effectiveLoaded < filteredModules.length;

  const changePageSize = (nextSize: number) => {
    setPageSize(nextSize);
    setLoadedCount(nextSize);
    setPage(1);
  };

  const loadMore = () => {
    const nextLoaded = Math.min(loadedCount + pageSize, filteredModules.length);
    setLoadedCount(nextLoaded);
    setPage(Math.max(1, Math.ceil(nextLoaded / pageSize)));
  };

  if (pageState === 'loading') return <Loading />;
  if (pageState === 'unavailable') {
    return (
      <div>
        <PageHeader title={t('pages.modules.title')} subtitle={t('pages.modules.description')} />
        <ErrorMessage message={serviceError ?? t('pages.modules.unavailable')} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('pages.modules.title')}
        subtitle={t('pages.modules.description')}
        actions={
          <button
            type="button"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              try {
                await load(true);
              } finally {
                setRefreshing(false);
              }
            }}
            className="btn-secondary btn-sm"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {t('pages.modules.refreshCatalog')}
          </button>
        }
      />

      {serviceError ? (
        <div className="mb-4">
          <ErrorMessage message={serviceError} />
        </div>
      ) : null}

      {!pyorchAvailable ? (
        <div className="mb-4 rounded-panel border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {t('pages.modules.pyorchHint')}
        </div>
      ) : null}

      <ModuleCatalogToolbar
        search={search}
        onSearchChange={setSearch}
        installFilter={installFilter}
        onInstallFilterChange={setInstallFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        categories={categories}
      />

      {filteredModules.length === 0 ? (
        <Empty message={t('pages.modules.noResults')} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleModules.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                locale={locale}
                busy={busy}
                onInstall={(id) => runAction(id, () => installModule(id))}
                onStart={(id) => runAction(id, () => startModule(id))}
                onStop={(id) => runAction(id, () => stopModule(id))}
                onUpdate={(id) => runAction(id, () => updateModule(id))}
                onUninstall={(id) => {
                  if (window.confirm(t('pages.modules.uninstallConfirm'))) {
                    void runAction(id, () => uninstallModule(id));
                  }
                }}
              />
            ))}
          </div>
          <ModuleCatalogFooter
            total={filteredModules.length}
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            effectiveLoaded={effectiveLoaded}
            canLoadMore={canLoadMore}
            onPageSizeChange={changePageSize}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            onLoadMore={loadMore}
          />
        </>
      )}
    </div>
  );
}

export function ModuleSettingsPage() {
  const { t, locale } = useLocale();
  const { moduleId = '' } = useParams<{ moduleId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'help' ? 'help' : 'settings';
  const [moduleName, setModuleName] = useState<string | null>(null);

  useEffect(() => {
    if (!moduleId) return;
    void listModuleCatalog()
      .then((catalog) => {
        const mod = catalog.find((m) => m.id === moduleId);
        if (mod) setModuleName(localized(mod.name, locale));
      })
      .catch(() => undefined);
  }, [moduleId, locale]);

  useBreadcrumbLastLabel(moduleName ?? moduleId);

  if (!moduleId) {
    return <ErrorMessage message={t('pages.modules.notFound')} />;
  }

  return (
    <div>
      <PageHeader
        title={moduleName ?? t('pages.modules.settingsTitle')}
        subtitle={moduleName ? moduleId : t('pages.modules.settingsTitle')}
      />
      <div className="tab-bar mb-4 grid-cols-2 sm:inline-grid sm:w-auto">
        <button
          type="button"
          className={tab === 'settings' ? 'tab-item tab-item-active' : 'tab-item'}
          onClick={() => setSearchParams({})}
        >
          {t('pages.modules.settingsTab')}
        </button>
        <button
          type="button"
          className={tab === 'help' ? 'tab-item tab-item-active' : 'tab-item'}
          onClick={() => setSearchParams({ tab: 'help' })}
        >
          {t('pages.modules.helpTab')}
        </button>
      </div>
      {tab === 'help' ? (
        <ModuleHelpFrame moduleId={moduleId} className="panel-card min-h-[320px] w-full" />
      ) : (
        <ModuleSettingsFrame moduleId={moduleId} />
      )}
    </div>
  );
}
