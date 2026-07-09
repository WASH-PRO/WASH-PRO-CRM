import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Shield,
  SkipForward,
} from 'lucide-react';
import clsx from 'clsx';
import { api, clearCatalogCache, deleteWash, formatWashDeleteSummary } from '../api/client';
import { syncMqttUsers } from '../api/postDevice';
import {
  checkApiHealth,
  loadSetupCatalogs,
  markSetupComplete,
  saveSetupSettings,
} from '../api/setup';
import { isDemoPostSerial, isDemoWash, SETUP_STEPS } from '../constants/setup';
import { useAuth } from '../context/AuthContext';
import { useSetupStatus } from '../hooks/useSetupStatus';
import { BrandLogo } from '../components/BrandLogo';
import { ThemeToggle } from '../components/ThemeToggle';
import { ErrorMessage } from '../components/UI';
import type { SetupSettings } from '../types';
import {
  canCreatePost,
  canCreateWash,
  canDeleteWash,
  canManageSystemSetup,
  canSyncMqtt,
  canUpdateCurrency,
  isReadOnlySetupUser,
  setupRoleHint,
} from '../utils/setupPermissions';
import {
  defaultMqttLogin,
  generateMqttPassword,
  mqttBrokerEndpoint,
  readPostMqttSettings,
} from '../utils/postMqtt';
import { setViewerSetupAck } from '../utils/setupStorage';
import { refId } from '../utils/refs';
import { useLocale } from '../i18n/LocaleContext';

const emptyWashForm = { name: '', address: '', description: '' };
const emptyPostForm = {
  washId: '',
  postNumber: 1,
  name: '',
  serialNumber: '',
  mqttLogin: '',
  mqttPassword: '',
};

function StepIndicator({
  current,
  skipped,
  skippedLabel,
}: {
  current: number;
  skipped: Set<string>;
  skippedLabel: string;
}) {
  return (
    <ol className="mb-8 flex flex-wrap gap-2">
      {SETUP_STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const skippedStep = skipped.has(step.id);
        return (
          <li
            key={step.id}
            className={clsx(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              active && 'bg-brand-500 text-white',
              done && !active && 'bg-brand-50 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300',
              !done && !active && 'bg-panel-canvas text-panel-muted dark:bg-white/5 dark:text-slate-400'
            )}
          >
            {done ? <CheckCircle2 size={12} /> : <Circle size={12} />}
            <span>{step.label}</span>
            {skippedStep && <span className="opacity-70">· {skippedLabel}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function SetupWizardPage() {
  const { t } = useLocale();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forceRestart = searchParams.get('restart') === '1';
  const { settings, settingId, reload, setSettings, loading } = useSetupStatus();

  const readOnly = isReadOnlySetupUser(user);
  const canManage = canManageSystemSetup(user?.permissions);
  const canWashCreate = canCreateWash(user?.permissions);
  const canWashDelete = canDeleteWash(user?.permissions);
  const canPostCreate = canCreatePost(user?.permissions);
  const canCurrencyUpdate = canUpdateCurrency(user?.permissions);
  const canMqtt = canSyncMqtt(user?.permissions);

  const [stepIndex, setStepIndex] = useState(0);
  const [skipped, setSkipped] = useState<Set<string>>(new Set(settings.skippedSteps || []));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState('');
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [catalogs, setCatalogs] = useState<Awaited<ReturnType<typeof loadSetupCatalogs>> | null>(null);

  const [washForm, setWashForm] = useState(emptyWashForm);
  const [postForm, setPostForm] = useState({ ...emptyPostForm, mqttPassword: generateMqttPassword() });
  const [defaultCurrencyId, setDefaultCurrencyId] = useState('');
  const [mqttSyncResult, setMqttSyncResult] = useState<string>('');

  const currentStep = SETUP_STEPS[stepIndex]!;
  const demoWash = useMemo(
    () => catalogs?.washes.find((w) => isDemoWash(w)),
    [catalogs?.washes]
  );
  const demoPosts = useMemo(
    () =>
      (catalogs?.posts || []).filter(
        (post) => isDemoPostSerial(post.serialNumber) || (demoWash && refId(post.washId) === demoWash.id)
      ),
    [catalogs?.posts, demoWash]
  );
  const hasDemoArtifacts = Boolean(demoWash) || demoPosts.length > 0;

  const refreshCatalogs = useCallback(async (preferredCurrencyId?: string) => {
    const data = await loadSetupCatalogs();
    setCatalogs(data);
    const defaultCurrency = data.currencies.find((c) => c.isDefault);
    const nextCurrencyId = preferredCurrencyId ?? defaultCurrency?.id ?? '';
    setDefaultCurrencyId(nextCurrencyId);
    if (!postForm.washId && data.washes.length === 1) {
      setPostForm((f) => ({ ...f, washId: data.washes[0]!.id }));
    }
    return data;
  }, [postForm.washId]);

  useEffect(() => {
    checkApiHealth().then(setApiOk);
    refreshCatalogs().catch((err) => {
      setError(err instanceof Error ? err.message : t('pages.setupWizard.errors.loadData'));
    });
  }, [refreshCatalogs]);

  useEffect(() => {
    if (settings.skippedSteps?.length) {
      setSkipped(new Set(settings.skippedSteps));
    }
  }, [settings.skippedSteps]);

  const persistSkipped = async (nextSkipped: Set<string>) => {
    if (!canManage) return;
    const next: SetupSettings = {
      ...settings,
      skippedSteps: [...nextSkipped],
    };
    const saved = await saveSetupSettings(next, settingId);
    setSettings(saved);
  };

  const goNext = async (skipCurrent = false) => {
    setError('');
    if (skipCurrent) {
      const nextSkipped = new Set(skipped).add(currentStep.id);
      setSkipped(nextSkipped);
      if (canManage) {
        try {
          await persistSkipped(nextSkipped);
        } catch (err) {
          setError(err instanceof Error ? err.message : t('pages.setupWizard.errors.saveProgress'));
          return;
        }
      }
    }
    if (stepIndex < SETUP_STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  const handleDeleteWash = async (washId: string, washName: string) => {
    if (!canWashDelete) return;
    if (
      !confirm(
        t('pages.setupWizard.confirmDeleteWash', { name: washName })
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    setDeleteStatus(t('pages.setupWizard.deletingWash', { name: washName }));
    try {
      const result = await deleteWash(washId);
      setDeleteStatus(formatWashDeleteSummary([result]));
      try {
        await syncMqttUsers();
      } catch {
        /* MQTT sync is best-effort after delete */
      }
      await refreshCatalogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.setupWizard.errors.deleteWash'));
      setDeleteStatus('');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDemo = async () => {
    if (!canWashDelete) return;
    if (demoWash) {
      await handleDeleteWash(demoWash.id, demoWash.name);
      return;
    }
    if (demoPosts.length === 0) return;
    if (
      !confirm(
        t('pages.setupWizard.confirmDeleteDemoPosts', { count: demoPosts.length })
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    setDeleteStatus(t('pages.setupWizard.deletingDemoPosts'));
    try {
      for (const post of demoPosts) {
        await api(`/crm/posts/${post.id}`, { method: 'DELETE' });
      }
      clearCatalogCache('/crm/posts');
      setDeleteStatus(t('pages.setupWizard.deletedDemoPosts', { count: demoPosts.length }));
      try {
        await syncMqttUsers();
      } catch {
        /* MQTT sync is best-effort after delete */
      }
      await refreshCatalogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.setupWizard.errors.deleteDemoData'));
      setDeleteStatus('');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateWash = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWashCreate) return;
    setBusy(true);
    setError('');
    try {
      await api('/crm/washes', {
        method: 'POST',
        body: JSON.stringify({
          name: washForm.name.trim(),
          address: washForm.address.trim(),
          description: washForm.description.trim(),
          cloudEnabled: false,
        }),
      });
      clearCatalogCache('/crm/washes');
      setWashForm(emptyWashForm);
      await refreshCatalogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.setupWizard.errors.createWash'));
    } finally {
      setBusy(false);
    }
  };

  const handleCreatePost = async (e: FormEvent) => {
    e.preventDefault();
    if (!canPostCreate) return;
    setBusy(true);
    setError('');
    try {
      const mqttLogin = postForm.mqttLogin.trim() || defaultMqttLogin(postForm.serialNumber);
      const mqttPassword = postForm.mqttPassword.trim() || generateMqttPassword();
      await api('/crm/posts', {
        method: 'POST',
        body: JSON.stringify({
          washId: postForm.washId,
          postNumber: Number(postForm.postNumber),
          name: postForm.name.trim(),
          serialNumber: postForm.serialNumber.trim(),
          settings: { mqttLogin, mqttPassword },
        }),
      });
      clearCatalogCache('/crm/posts');
      setPostForm({ ...emptyPostForm, mqttPassword: generateMqttPassword(), washId: postForm.washId });
      await refreshCatalogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.setupWizard.errors.createPost'));
    } finally {
      setBusy(false);
    }
  };

  const handleSetDefaultCurrency = async () => {
    if (!defaultCurrencyId || !canCurrencyUpdate || !catalogs) return;
    const savedId = defaultCurrencyId;
    setBusy(true);
    setError('');
    try {
      for (const item of catalogs.currencies) {
        if (item.isDefault && item.id !== savedId) {
          await api(`/crm/currencies/${item.id}`, {
            method: 'PUT',
            body: JSON.stringify({ ...item, isDefault: false }),
          });
        }
      }
      const selected = catalogs.currencies.find((c) => c.id === savedId);
      if (selected) {
        await api(`/crm/currencies/${selected.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...selected, isDefault: true }),
        });
      }
      clearCatalogCache('/crm/currencies');
      setCatalogs((prev) =>
        prev
          ? {
              ...prev,
              currencies: prev.currencies.map((c) => ({
                ...c,
                isDefault: c.id === savedId,
              })),
            }
          : prev
      );
      setDefaultCurrencyId(savedId);
      await refreshCatalogs(savedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.setupWizard.errors.updateCurrency'));
    } finally {
      setBusy(false);
    }
  };

  const handleMqttSync = async () => {
    if (!canMqtt) return;
    setBusy(true);
    setError('');
    setMqttSyncResult('');
    try {
      const result = await syncMqttUsers();
      setMqttSyncResult(t('pages.setupWizard.mqttSyncedUsers', { count: result.postUsers }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.setupWizard.errors.syncMqtt'));
    } finally {
      setBusy(false);
    }
  };

  const finishWizard = async () => {
    setBusy(true);
    setError('');
    try {
      if (readOnly && user) {
        setViewerSetupAck(user.id);
        navigate('/', { replace: true });
        return;
      }
      if (!user || !canManage) {
        setError(t('pages.setupWizard.errors.noFinishPermission'));
        return;
      }
      await markSetupComplete(user, settingId, settings, [...skipped]);
      await reload();
      navigate(forceRestart ? '/' : '/welcome', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.setupWizard.errors.finish'));
    } finally {
      setBusy(false);
    }
  };

  const renderStep = () => {
    switch (currentStep.id) {
      case 'welcome':
        return (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-panel-muted dark:text-panel-muted-dark">
              {t('pages.setupWizard.welcomeText')}
            </p>
            {readOnly && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-50/80 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
                <Shield size={16} className="mt-0.5 shrink-0" />
                <span>
                  {t('pages.setupWizard.readOnlyHint', { role: setupRoleHint(user) })}
                </span>
              </div>
            )}
            {forceRestart && canManage && (
              <p className="text-sm text-brand-600 dark:text-brand-400">
                {t('pages.setupWizard.restartHint')}
              </p>
            )}
          </div>
        );

      case 'infra':
        return (
          <div className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                {apiOk ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <Circle size={16} className="text-panel-muted" />
                )}
                {t('pages.setupWizard.apiStatus', {
                  status:
                    apiOk === true
                      ? t('pages.setupWizard.statusAvailable')
                      : apiOk === false
                        ? t('pages.setupWizard.statusUnavailable')
                        : t('pages.setupWizard.statusChecking'),
                })}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                {t('pages.setupWizard.mqttBroker')}:{' '}
                <code className="rounded bg-panel-canvas px-1.5 py-0.5 text-xs">{mqttBrokerEndpoint()}</code>
              </li>
            </ul>
            <div className="rounded-lg border border-panel-border bg-panel-canvas/60 p-4 text-xs text-panel-muted dark:border-panel-border-dark dark:bg-white/[0.03]">
              <p className="mb-2 font-medium text-panel-ink dark:text-panel-ink-dark">{t('pages.setupWizard.envParams')}</p>
              <ul className="space-y-1 font-mono">
                <li>{t('pages.setupWizard.envMqttPort')}</li>
                <li>{t('pages.setupWizard.envJwt')}</li>
                <li>{t('pages.setupWizard.envDataDir')}</li>
              </ul>
            </div>
            <button type="button" className="btn-secondary btn-sm" onClick={() => checkApiHealth().then(setApiOk)}>
              <RefreshCw size={14} />
              {t('pages.setupWizard.checkAgain')}
            </button>
          </div>
        );

      case 'wash':
        return (
          <div className="space-y-4">
            <p className="text-sm text-panel-muted dark:text-panel-muted-dark">
              {t('pages.setupWizard.washesInSystem', { count: catalogs?.washes.length ?? '…' })}
            </p>
            {hasDemoArtifacts && (
              <div className="rounded-lg border border-panel-border p-3 dark:border-panel-border-dark">
                <div className="text-sm font-medium">
                  {demoWash ? demoWash.name : t('pages.setupWizard.demoData')}
                </div>
                <div className="mt-1 text-xs text-panel-muted">
                  {(demoWash ? t('pages.setupWizard.demoWash') : t('pages.setupWizard.demoPostsOnly'))} ·{' '}
                  {t('pages.setupWizard.postsCount', { count: demoPosts.length })}
                </div>
                <p className="mt-2 text-xs text-panel-muted dark:text-panel-muted-dark">
                  {t('pages.setupWizard.demoDeleteHint')}
                </p>
                {canWashDelete ? (
                  <button
                    type="button"
                    className="btn-secondary btn-sm mt-3 text-red-600 dark:text-red-400"
                    onClick={handleDeleteDemo}
                    disabled={busy}
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                    {t('pages.setupWizard.deleteDemoData')}
                  </button>
                ) : (
                  <p className="mt-2 text-xs text-panel-muted">{t('pages.setupWizard.deleteRequiresPermission')}</p>
                )}
                {deleteStatus && (
                  <p
                    className={clsx(
                      'mt-2 text-xs',
                      deleteStatus.startsWith(t('pages.setupWizard.deletedPrefix'))
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-panel-muted dark:text-panel-muted-dark'
                    )}
                  >
                    {deleteStatus}
                  </p>
                )}
              </div>
            )}
            {canWashCreate ? (
              <form onSubmit={handleCreateWash} className="space-y-3 rounded-lg border border-panel-border p-4 dark:border-panel-border-dark">
                <p className="text-sm font-medium">{t('pages.setupWizard.createRealWash')}</p>
                <div>
                  <label className="label">{t('pages.setupWizard.name')}</label>
                  <input className="input" value={washForm.name} onChange={(e) => setWashForm({ ...washForm, name: e.target.value })} required />
                </div>
                <div>
                  <label className="label">{t('pages.setupWizard.address')}</label>
                  <input className="input" value={washForm.address} onChange={(e) => setWashForm({ ...washForm, address: e.target.value })} required />
                </div>
                <div>
                  <label className="label">{t('pages.setupWizard.description')}</label>
                  <input className="input" value={washForm.description} onChange={(e) => setWashForm({ ...washForm, description: e.target.value })} />
                </div>
                <button type="submit" className="btn-primary btn-sm" disabled={busy}>
                  {t('pages.setupWizard.createWash')}
                </button>
              </form>
            ) : (
              <p className="text-sm text-panel-muted">{t('pages.setupWizard.createWashPermission')}</p>
            )}
            {(catalogs?.washes.length ?? 0) > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('pages.setupWizard.washesTitle')}</p>
                <ul className="text-sm">
                  {(catalogs?.washes || []).map((w) => (
                    <li
                      key={w.id}
                      className="flex items-center justify-between gap-3 border-b border-panel-border py-2 last:border-0 dark:border-panel-border-dark"
                    >
                      <span>{w.name}</span>
                      {canWashDelete && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm shrink-0 text-red-600 dark:text-red-400"
                          onClick={() => handleDeleteWash(w.id, w.name)}
                          disabled={busy}
                        >
                          {t('pages.setupWizard.deleteData')}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'posts':
        return (
          <div className="space-y-4">
            {canPostCreate && (catalogs?.washes.length ?? 0) > 0 ? (
              <form onSubmit={handleCreatePost} className="space-y-3 rounded-lg border border-panel-border p-4 dark:border-panel-border-dark">
                <p className="text-sm font-medium">{t('pages.setupWizard.addPost')}</p>
                <div>
                  <label className="label">{t('pages.setupWizard.wash')}</label>
                  <select className="input" value={postForm.washId} onChange={(e) => setPostForm({ ...postForm, washId: e.target.value })} required>
                    <option value="">{t('pages.setupWizard.select')}</option>
                    {(catalogs?.washes || []).map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">{t('pages.setupWizard.number')}</label>
                    <input type="number" className="input" min={1} value={postForm.postNumber} onChange={(e) => setPostForm({ ...postForm, postNumber: Number(e.target.value) })} required />
                  </div>
                  <div>
                    <label className="label">{t('pages.setupWizard.serialNumber')}</label>
                    <input className="input" value={postForm.serialNumber} onChange={(e) => setPostForm({ ...postForm, serialNumber: e.target.value })} required />
                  </div>
                </div>
                <div>
                  <label className="label">{t('pages.setupWizard.name')}</label>
                  <input className="input" value={postForm.name} onChange={(e) => setPostForm({ ...postForm, name: e.target.value })} required />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">{t('pages.setupWizard.mqttLogin')}</label>
                    <input className="input" value={postForm.mqttLogin} onChange={(e) => setPostForm({ ...postForm, mqttLogin: e.target.value })} placeholder={defaultMqttLogin(postForm.serialNumber || 'post')} />
                  </div>
                  <div>
                    <label className="label">{t('pages.setupWizard.mqttPassword')}</label>
                    <input className="input font-mono text-xs" value={postForm.mqttPassword} onChange={(e) => setPostForm({ ...postForm, mqttPassword: e.target.value })} />
                  </div>
                </div>
                <button type="submit" className="btn-primary btn-sm" disabled={busy}>
                  {t('pages.setupWizard.createPost')}
                </button>
              </form>
            ) : (
              <p className="text-sm text-panel-muted">
                {!canPostCreate ? t('pages.setupWizard.createPostPermission') : t('pages.setupWizard.createWashFirst')}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-panel-muted">
                    <th className="pb-2 pr-3">{t('refs.post')}</th>
                    <th className="pb-2 pr-3">S/N</th>
                    <th className="pb-2">MQTT</th>
                  </tr>
                </thead>
                <tbody>
                  {(catalogs?.posts || []).map((p) => {
                    const mqtt = readPostMqttSettings(p.settings);
                    return (
                      <tr key={p.id} className="border-t border-panel-border dark:border-panel-border-dark">
                        <td className="py-2 pr-3">{p.name}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{p.serialNumber}</td>
                        <td className="py-2 font-mono text-xs">{mqtt.mqttLogin || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'currency':
        return (
          <div className="space-y-4">
            <p className="text-sm text-panel-muted">
              {t('pages.setupWizard.currenciesInRef', { count: catalogs?.currencies.length ?? '…' })}
            </p>
            {canCurrencyUpdate ? (
              <div className="space-y-2">
                <label className="label">{t('pages.setupWizard.defaultCurrency')}</label>
                <select className="input" value={defaultCurrencyId} onChange={(e) => setDefaultCurrencyId(e.target.value)}>
                  <option value="">{t('pages.setupWizard.select')}</option>
                  {(catalogs?.currencies || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name} ({c.symbol}){c.isDefault ? ` · ${t('pages.setupWizard.current')}` : ''}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn-primary btn-sm" onClick={handleSetDefaultCurrency} disabled={busy || !defaultCurrencyId}>
                  {t('common.save')}
                </button>
              </div>
            ) : (
              <p className="text-sm">
                {t('pages.setupWizard.currentCurrency')}:{' '}
                <span className="font-medium">
                  {catalogs?.currencies.find((c) => c.isDefault)?.code || t('pages.setupWizard.notSet')}
                </span>
                <span className="text-panel-muted"> ({t('pages.setupWizard.updatePermissionHint')})</span>
              </p>
            )}
          </div>
        );

      case 'mqtt':
        return (
          <div className="space-y-4">
            <p className="text-sm text-panel-muted dark:text-panel-muted-dark">
              {t('pages.setupWizard.mqttSyncHint')}
            </p>
            <p className="text-sm">
              {t('pages.setupWizard.deviceBrokerAddress')}:{' '}
              <code className="rounded bg-panel-canvas px-1.5 py-0.5 text-xs">{mqttBrokerEndpoint()}</code>
            </p>
            {canMqtt ? (
              <button type="button" className="btn-primary btn-sm" onClick={handleMqttSync} disabled={busy}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {t('pages.setupWizard.syncMqtt')}
              </button>
            ) : (
              <p className="text-sm text-panel-muted">{t('pages.setupWizard.syncMqttPermission')}</p>
            )}
            {mqttSyncResult && <p className="text-sm text-emerald-600 dark:text-emerald-400">{mqttSyncResult}</p>}
          </div>
        );

      case 'refs':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: t('nav.items.workModes'), count: catalogs?.workModes.length, to: '/work-modes' },
              { label: t('nav.items.discountTypes'), count: catalogs?.discountTypes.length, to: '/discount-types' },
              { label: t('nav.items.currency'), count: catalogs?.currencies.length, to: '/currency' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-panel-border p-4 dark:border-panel-border-dark">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="mt-1 text-2xl font-semibold">{item.count ?? '…'}</div>
                <Link to={item.to} className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400">
                  {t('pages.setupWizard.openRef')}
                  <ExternalLink size={12} />
                </Link>
              </div>
            ))}
          </div>
        );

      case 'done':
        return (
          <div className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li>{t('pages.setupWizard.washesCount', { count: catalogs?.washes.length ?? 0 })}</li>
              <li>{t('pages.setupWizard.postsCount', { count: catalogs?.posts.length ?? 0 })}</li>
              <li>
                {t('nav.items.currency')}: {catalogs?.currencies.find((c) => c.isDefault)?.code || '—'}
              </li>
              {skipped.size > 0 && (
                <li className="text-panel-muted">{t('pages.setupWizard.skippedSteps', { count: skipped.size })}</li>
              )}
            </ul>
            {readOnly ? (
              <p className="text-sm text-panel-muted">
                {t('pages.setupWizard.readOnlyDoneHint')}
              </p>
            ) : (
              <p className="text-sm text-panel-muted">
                {t('pages.setupWizard.doneHint')}{' '}
                <code className="text-xs">/setup?restart=1</code>.
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const isLast = stepIndex === SETUP_STEPS.length - 1;

  if (!loading && settings.complete && !forceRestart) {
    return <Navigate to="/" replace />;
  }

  if (!loading && forceRestart && !canManage) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-panel-canvas dark:bg-panel-canvas-dark">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2 text-sm text-panel-muted">
          <BrandLogo size="sm" />
          <span>{t('nav.items.setupWizard')}</span>
        </div>
        <div className="flex items-center gap-2">
          {canManage && settings.complete && !forceRestart && (
            <Link to="/" className="btn-secondary btn-sm">
              {t('nav.items.dashboard')}
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12">
        <StepIndicator current={stepIndex} skipped={skipped} skippedLabel={t('pages.setupWizard.skipped')} />

        <div className="rounded-2xl border border-panel-border bg-panel-surface p-6 shadow-panel dark:border-panel-border-dark dark:bg-panel-surface-dark sm:p-8">
          <h1 className="font-display text-xl font-semibold text-panel-ink dark:text-white sm:text-2xl">
            {currentStep.label}
          </h1>

          <div className="mt-5">{renderStep()}</div>

          {error && (
            <div className="mt-4">
              <ErrorMessage message={error} />
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="btn-secondary" onClick={goBack} disabled={stepIndex === 0 || busy}>
              <ArrowLeft size={16} />
              {t('dataTable.prev')}
            </button>

            <div className="flex flex-wrap gap-2">
              {!isLast && !readOnly && (
                <button type="button" className="btn-secondary" onClick={() => goNext(true)} disabled={busy}>
                  <SkipForward size={16} />
                  {t('pages.setupWizard.skip')}
                </button>
              )}
              {isLast ? (
                <button type="button" className="btn-primary" onClick={finishWizard} disabled={busy}>
                  {busy && <Loader2 size={16} className="animate-spin" />}
                  {readOnly ? t('pages.setupWizard.gotIt') : t('pages.setupWizard.finish')}
                </button>
              ) : (
                <button type="button" className="btn-primary" onClick={() => goNext(false)} disabled={busy}>
                  {t('dataTable.next')}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
