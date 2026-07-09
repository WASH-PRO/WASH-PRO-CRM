import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, apiListBounded } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Loading, ErrorMessage } from '../components/UI';
import { PostOnlineStatus } from '../components/PostOnlineStatus';
import { PostDeviceSettings } from '../components/PostDeviceSettings';
import { DataTable, type DataTableBulkAction, type DataTableColumn } from '../components/DataTable';
import { usePolling } from '../hooks/usePolling';
import { useCurrency } from '../hooks/useCurrency';
import { useWorkModes } from '../hooks/useWorkModes';
import { useLocale } from '../i18n/LocaleContext';
import { LIVE_INTERVAL_FAST_MS } from '../constants/live';
import { formatPause, formatDateTime, formatMoney } from '../utils/format';
import { refId } from '../utils/refs';
import { latestPostStateByPost } from '../utils/statsAggregation';
import { createExportBulkAction } from '../utils/export';
import { useBreadcrumbLastLabel } from '../context/BreadcrumbContext';
import type { Post, PostSettings, PostState, Wash } from '../types';
import { parseModePrices } from '../utils/postDevice';

import { fetchPostStateHistory, type PostStateHistoryRow } from '../utils/postTelemetry';

interface PostDetailData {
  post: Post;
  wash: Wash;
  currentState: PostState | null;
  stateHistory: PostStateHistoryRow[];
  historyTruncated: boolean;
}

function parseSettings(raw?: PostSettings | Record<string, unknown>): PostSettings {
  if (!raw) return {};
  return {
    firmwareVersion: raw.firmwareVersion != null ? String(raw.firmwareVersion) : undefined,
    warrantyUntil: raw.warrantyUntil != null ? String(raw.warrantyUntil) : undefined,
    maintenance: raw.maintenance != null ? String(raw.maintenance) : undefined,
    features: raw.features != null ? String(raw.features) : undefined,
    mqttPrefix: raw.mqttPrefix != null ? String(raw.mqttPrefix) : undefined,
    modePrices: parseModePrices(raw.modePrices),
    pricesUpdatedAt: raw.pricesUpdatedAt != null ? String(raw.pricesUpdatedAt) : undefined,
    pricesSyncedAt: raw.pricesSyncedAt != null ? String(raw.pricesSyncedAt) : undefined,
    lastCommand: raw.lastCommand != null ? String(raw.lastCommand) : undefined,
    lastCommandAt: raw.lastCommandAt != null ? String(raw.lastCommandAt) : undefined,
  };
}

export function PostDetailPage() {
  const { postId = '' } = useParams();
  const { hasPermission } = useAuth();
  const { locale, t } = useLocale();
  const canEdit = hasPermission('update', 'create');
  const { currency } = useCurrency();
  const { label: workModeLabel } = useWorkModes();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const formHydrated = useRef(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    serialNumber: '',
    firmwareVersion: '',
    warrantyUntil: '',
    maintenance: '',
    features: '',
  });

  const fetchData = useCallback(async (signal: AbortSignal): Promise<PostDetailData | null> => {
    let post: Post;
    try {
      post = await api<Post>(`/crm/posts/${postId}?populate=washId`);
    } catch {
      return null;
    }

    const stopBefore = historyDateFrom ? new Date(historyDateFrom).getTime() : undefined;
    const [stateHistoryResult, states] = await Promise.all([
      fetchPostStateHistory(post.serialNumber, { signal, stopBefore }),
      apiListBounded<PostState>('/crm/post-states', signal, 5),
    ]);
    const { rows: stateHistory, truncated } = stateHistoryResult;
    const currentState =
      latestPostStateByPost(states).find((s) => refId(s.postId) === post.id) ?? null;

    const washId = refId(post.washId);
    const wash =
      typeof post.washId === 'object' && post.washId !== null && 'address' in post.washId
        ? (post.washId as Wash)
        : ({ id: washId, name: '—', address: '' } as Wash);

    return {
      post,
      wash,
      currentState,
      stateHistory,
      historyTruncated: truncated,
    };
  }, [postId, historyDateFrom]);

  const { data, loading, refresh, lastUpdatedAt } = usePolling(fetchData, [postId, historyDateFrom], {
    intervalMs: LIVE_INTERVAL_FAST_MS,
  });

  useBreadcrumbLastLabel(data?.post.serialNumber);

  useEffect(() => {
    formHydrated.current = false;
  }, [postId]);

  useEffect(() => {
    if (!data || formHydrated.current) return;
    const settings = parseSettings(data.post.settings);
    setForm({
      name: data.post.name,
      address: data.wash?.address || '',
      serialNumber: data.post.serialNumber,
      firmwareVersion: settings.firmwareVersion || '',
      warrantyUntil: settings.warrantyUntil || '',
      maintenance: settings.maintenance || '',
      features: settings.features || '',
    });
    formHydrated.current = true;
  }, [data]);

  useEffect(() => {
    if (window.location.hash === '#device-settings') {
      document.getElementById('device-settings')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [data]);

  const filteredStateHistory = useMemo(() => {
    let rows = data?.stateHistory ?? [];
    if (historyDateFrom) {
      const from = new Date(historyDateFrom).getTime();
      rows = rows.filter((r) => new Date(r.receivedAt || 0).getTime() >= from);
    }
    if (historyDateTo) {
      const to = new Date(historyDateTo).getTime() + 86400000;
      rows = rows.filter((r) => new Date(r.receivedAt || 0).getTime() <= to);
    }
    return rows;
  }, [data?.stateHistory, historyDateFrom, historyDateTo]);

  const applyHistoryPeriod = (days: number | null) => {
    if (days === null) {
      setHistoryDateFrom('');
      setHistoryDateTo('');
      return;
    }
    const to = new Date();
    const from = new Date();
    if (days === 0) {
      const today = to.toISOString().slice(0, 10);
      setHistoryDateFrom(today);
      setHistoryDateTo(today);
      return;
    }
    from.setDate(from.getDate() - (days - 1));
    setHistoryDateFrom(from.toISOString().slice(0, 10));
    setHistoryDateTo(to.toISOString().slice(0, 10));
  };

  const stateColumns: DataTableColumn<PostStateHistoryRow>[] = useMemo(
    () => [
      {
        key: 'receivedAt',
        header: t('pages.postDetail.history.columns.time'),
        sortable: true,
        sortValue: (r) => new Date(r.receivedAt || 0).getTime(),
        searchValue: (r) => formatDateTime(r.receivedAt),
        render: (r) => formatDateTime(r.receivedAt),
      },
      {
        key: 'balance',
        header: t('pages.postDetail.history.columns.balance'),
        sortable: true,
        sortValue: (r) => r.balance ?? -1,
        render: (r) =>
          r.balance != null ? (
            <span className="font-mono">{formatMoney(r.balance, currency)}</span>
          ) : (
            t('common.notAvailable')
          ),
      },
      {
        key: 'freePause',
        header: t('pages.postDetail.history.columns.freePause'),
        sortable: true,
        sortValue: (r) => r.freePause ?? -1,
        render: (r) => formatPause(r.freePause),
      },
      {
        key: 'discount',
        header: t('pages.postDetail.history.columns.discount'),
        sortable: true,
        sortValue: (r) => r.discount ?? -1,
        render: (r) =>
          r.discount != null ? (
            <span className="font-mono">{formatMoney(r.discount, currency)}</span>
          ) : (
            t('common.notAvailable')
          ),
      },
      {
        key: 'mode',
        header: t('pages.postDetail.history.columns.mode'),
        sortable: true,
        sortValue: (r) => workModeLabel(r.modeName),
        searchValue: (r) => workModeLabel(r.modeName),
        render: (r) => workModeLabel(r.modeName),
      },
    ],
    [currency, workModeLabel, t]
  );

  const historyBulkActions = useMemo((): DataTableBulkAction<PostStateHistoryRow>[] => {
    const serial = data?.post.serialNumber || t('pages.postDetail.export.fallbackSerial');
    return [
      createExportBulkAction(`post-${serial}-states.csv`, [
        { header: t('pages.postDetail.history.columns.time'), value: (r) => r.receivedAt || '' },
        { header: t('pages.postDetail.history.columns.balance'), value: (r) => (r.balance != null ? formatMoney(r.balance, currency) : '') },
        { header: t('pages.postDetail.history.columns.freePause'), value: (r) => formatPause(r.freePause) },
        { header: t('pages.postDetail.history.columns.discount'), value: (r) => (r.discount != null ? formatMoney(r.discount, currency) : '') },
        { header: t('pages.postDetail.history.columns.mode'), value: (r) => workModeLabel(r.modeName) },
      ]),
    ];
  }, [currency, data?.post.serialNumber, workModeLabel, t]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!data || !canEdit) return;
    setError('');
    setSaved('');
    try {
      const settings = parseSettings(data.post.settings);
      const nextSettings: PostSettings = {
        ...settings,
        maintenance: form.maintenance || undefined,
        features: form.features || undefined,
      };

      await api(`/crm/posts/${data.post.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          washId: refId(data.post.washId),
          postNumber: data.post.postNumber,
          name: form.name,
          serialNumber: data.post.serialNumber,
          settings: nextSettings,
        }),
      });

      const washId = refId(data.post.washId);
      if (data.wash && form.address !== data.wash.address) {
        await api(`/crm/washes/${washId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: data.wash.name,
            description: data.wash.description || '',
            address: form.address,
            registeredAt: data.wash.registeredAt,
            cloudEnabled: data.wash.cloudEnabled ?? false,
          }),
        });
      }

      setSaved(t('pages.postDetail.saved'));
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.saveFailed'));
    }
  };

  if (loading && !data) return <Loading />;

  if (!data) {
    return (
      <div>
        <PageHeader title={t('pages.postDetail.notFoundTitle')} />
        <Link to="/states" className="text-sm text-brand-600 hover:underline">
          {t('pages.postDetail.backToStatesArrow')}
        </Link>
      </div>
    );
  }

  const { post, wash, currentState } = data;

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/states"
          className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline dark:text-brand-400"
        >
          <ArrowLeft size={14} />
          {t('pages.postDetail.backToStates')}
        </Link>
      </div>

      <PageHeader
        title={t('pages.postDetail.title', { number: post.postNumber, name: form.name ? ` — ${form.name}` : '' })}
        subtitle={t('pages.postDetail.subtitle', {
          wash: wash?.name || t('common.notAvailable'),
          serial: post.serialNumber,
          updated: lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString(locale) : t('common.notAvailable'),
        })}
        actions={<PostOnlineStatus state={currentState ?? undefined} />}
      />

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} />
        </div>
      )}
      {saved && <p className="mb-4 text-sm text-emerald-600">{saved}</p>}

      <form onSubmit={handleSubmit} className="card mb-6 space-y-4">
        <h2 className="font-semibold">{t('pages.postDetail.descriptionTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t('pages.postDetail.fields.postName')}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={!canEdit}
              required
            />
          </div>
          <div>
            <label className="label">{t('pages.postDetail.fields.objectAddress')}</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              disabled={!canEdit}
              required
            />
          </div>
          <div>
            <label className="label">{t('pages.postDetail.fields.serialNumber')}</label>
            <input
              className="input font-mono"
              value={form.serialNumber}
              disabled
              readOnly
            />
          </div>
          <div>
            <label className="label">{t('pages.postDetail.fields.firmwareVersion')}</label>
            <input
              className="input font-mono"
              value={form.firmwareVersion}
              disabled
              readOnly
              placeholder={t('common.notAvailable')}
            />
          </div>
          <div>
            <label className="label">{t('pages.postDetail.fields.warrantyUntil')}</label>
            <input
              className="input"
              type="date"
              value={form.warrantyUntil}
              disabled
              readOnly
            />
          </div>
          <div>
            <label className="label">{t('pages.postDetail.fields.wash')}</label>
            <input className="input" value={wash?.name || t('common.notAvailable')} disabled />
          </div>
        </div>
        <div>
          <label className="label">{t('pages.postDetail.fields.maintenance')}</label>
          <textarea
            className="input min-h-[80px]"
            value={form.maintenance}
            onChange={(e) => setForm({ ...form, maintenance: e.target.value })}
            disabled={!canEdit}
            placeholder={t('pages.postDetail.fields.maintenancePlaceholder')}
          />
        </div>
        <div>
          <label className="label">{t('pages.postDetail.fields.features')}</label>
          <textarea
            className="input min-h-[80px]"
            value={form.features}
            onChange={(e) => setForm({ ...form, features: e.target.value })}
            disabled={!canEdit}
            placeholder={t('pages.postDetail.fields.featuresPlaceholder')}
          />
        </div>
        {canEdit && (
          <button type="submit" className="btn-primary">
            {t('common.save')}
          </button>
        )}
      </form>

      <PostDeviceSettings
        serialNumber={post.serialNumber}
        settings={parseSettings(post.settings)}
        canEdit={canEdit}
        onSaved={refresh}
      />

      <h2 className="mb-3 font-semibold">{t('pages.postDetail.history.title')}</h2>
      {data.historyTruncated && (
        <p className="mb-3 text-sm text-panel-muted dark:text-panel-muted-dark">
          {t('pages.postDetail.history.truncatedHint')}
        </p>
      )}
      <DataTable
        tableId="post-state-history"
        columns={stateColumns}
        data={filteredStateHistory}
        rowKey={(r) => r.id}
        emptyMessage={
          historyDateFrom || historyDateTo
            ? t('pages.postDetail.history.emptyFiltered')
            : t('pages.postDetail.history.empty')
        }
        defaultSortKey="receivedAt"
        defaultSortDir="desc"
        searchPlaceholder={t('pages.postDetail.history.searchPlaceholder')}
        toolbarPlacement="start"
        bulkActions={historyBulkActions}
        toolbar={
          <div className="toolbar-cluster">
            <input
              type="date"
              className="input-inline"
              value={historyDateFrom}
              onChange={(e) => setHistoryDateFrom(e.target.value)}
              aria-label={t('pages.postDetail.history.from')}
            />
            <span className="text-sm text-panel-muted">{t('common.notAvailable')}</span>
            <input
              type="date"
              className="input-inline"
              value={historyDateTo}
              onChange={(e) => setHistoryDateTo(e.target.value)}
              aria-label={t('pages.postDetail.history.to')}
            />
            <button type="button" className="btn-secondary btn-sm" onClick={() => applyHistoryPeriod(null)}>
              {t('common.all')}
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => applyHistoryPeriod(0)}>
              {t('pages.postDetail.history.today')}
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => applyHistoryPeriod(7)}>
              {t('pages.postDetail.history.days7')}
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => applyHistoryPeriod(30)}>
              {t('pages.postDetail.history.days30')}
            </button>
          </div>
        }
      />

    </div>
  );
}
