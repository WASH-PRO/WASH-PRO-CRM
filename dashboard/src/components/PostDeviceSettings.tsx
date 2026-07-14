import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { apiListPage } from '../api/client';
import { sendPostCommand, sendPostPrices } from '../api/postDevice';
import { useWorkModes } from '../hooks/useWorkModes';
import { useCurrency } from '../hooks/useCurrency';
import { ErrorMessage } from './UI';
import type { PostSettings } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import {
  commandNeedsAmount,
  getDeviceCommandOptions,
  isModePriceReadonly,
  parseModePrices,
  hasModePrices,
  type DeviceCommandKey,
} from '../utils/postDevice';

interface PostDeviceSettingsProps {
  serialNumber: string;
  settings?: PostSettings;
  canEdit: boolean;
  onSaved?: () => void;
}

export function PostDeviceSettings({ serialNumber, settings, canEdit, onSaved }: PostDeviceSettingsProps) {
  const { t, locale } = useLocale();
  const deviceCommandOptions = useMemo(() => getDeviceCommandOptions(), [locale]);
  const { modes } = useWorkModes();
  const { currency } = useCurrency();
  const [mqttPrefix, setMqttPrefix] = useState(settings?.mqttPrefix || 'washpro');
  const [prices, setPrices] = useState<Record<string, number>>(() => parseModePrices(settings?.modePrices));
  const [sendToDevice, setSendToDevice] = useState(true);
  const [command, setCommand] = useState<DeviceCommandKey>('soft_reset');
  const [creditAmount, setCreditAmount] = useState('');
  const [pricesBusy, setPricesBusy] = useState(false);
  const [pullBusy, setPullBusy] = useState(false);
  const [commandBusy, setCommandBusy] = useState(false);
  const [pricesMsg, setPricesMsg] = useState('');
  const [pricesErr, setPricesErr] = useState('');
  const [commandMsg, setCommandMsg] = useState('');
  const [commandErr, setCommandErr] = useState('');

  const sortedModes = useMemo(
    () => [...modes].sort((a, b) => Number(a.code) - Number(b.code)),
    [modes]
  );

  const prevSerial = useRef(serialNumber);
  const formDirty = useRef(false);

  useEffect(() => {
    if (prevSerial.current !== serialNumber) {
      prevSerial.current = serialNumber;
      formDirty.current = false;
    }
    if (formDirty.current) return;
    setMqttPrefix(settings?.mqttPrefix || 'washpro');
    setPrices(parseModePrices(settings?.modePrices));
  }, [serialNumber, settings?.mqttPrefix, settings?.modePrices]);

  const setPrice = (code: string, value: string) => {
    if (isModePriceReadonly(code)) return;
    formDirty.current = true;
    setPrices((prev) => {
      const next = { ...prev };
      if (value === '') {
        delete next[code];
        return next;
      }
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) next[code] = n;
      return next;
    });
  };

  const pullPricesFromMqtt = async () => {
    setPullBusy(true);
    setPricesErr('');
    try {
      const { data } = await apiListPage<{
        id: string;
        postSerial?: string;
        messageType: string;
        payload: Record<string, unknown>;
        receivedAt?: string;
      }>(
        `/crm/telemetry?postSerial=${encodeURIComponent(serialNumber)}&messageType=prices&sort=receivedAt&sortDir=desc`,
        1,
        20
      );
      const row = data.find((r) => r.messageType === 'prices' && r.payload?.direction !== 'outbound');
      if (!row) {
        setPricesErr(
          t('postDevice.mqttPricesMissing')
        );
        return;
      }
      const parsed = parseModePrices(row.payload);
      if (!hasModePrices(parsed)) {
        setPricesErr(
          t('postDevice.mqttFormatUnknown', { payload: JSON.stringify(row.payload).slice(0, 120) })
        );
        return;
      }
      setPrices(parsed);
      formDirty.current = true;
      setPricesMsg(
        t('postDevice.pulledFromMqtt', {
          date: new Date(row.receivedAt || '').toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US'),
        })
      );
    } catch (err) {
      setPricesErr(err instanceof Error ? err.message : t('postDevice.errors.loadFromMqtt'));
    } finally {
      setPullBusy(false);
    }
  };

  const pricesLoaded = hasModePrices(prices);

  const handlePricesSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setPricesBusy(true);
    setPricesErr('');
    setPricesMsg('');
    try {
      const result = await sendPostPrices(serialNumber, {
        prices,
        mqttPrefix: mqttPrefix.trim() || 'washpro',
        sendToDevice,
        persist: true,
      });
      const sent = result.topic
        ? t('postDevice.savedTopic', { topic: result.topic })
        : t('postDevice.savedOnlyCrm');
      setPricesMsg(t('postDevice.saved', { details: sent }));
      formDirty.current = false;
      onSaved?.();
    } catch (err) {
      setPricesErr(err instanceof Error ? err.message : t('postDevice.errors.savePrices'));
    } finally {
      setPricesBusy(false);
    }
  };

  const handleCommandSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const label = deviceCommandOptions.find((o) => o.value === command)?.label || command;
    if (!confirm(t('postDevice.confirmCommand', { label, serial: serialNumber }))) return;

    setCommandBusy(true);
    setCommandErr('');
    setCommandMsg('');
    try {
      const amount = commandNeedsAmount(command) ? Number(creditAmount) : undefined;
      const result = await sendPostCommand(serialNumber, {
        command,
        amount,
        mqttPrefix: mqttPrefix.trim() || 'washpro',
      });
      setCommandMsg(t('postDevice.commandSent', { topic: result.topic }));
      onSaved?.();
    } catch (err) {
      setCommandErr(err instanceof Error ? err.message : t('postDevice.errors.sendCommand'));
    } finally {
      setCommandBusy(false);
    }
  };

  return (
    <section id="device-settings" className="card mb-6 space-y-6 scroll-mt-4">
      <div>
        <h2 className="font-semibold">{t('postDevice.title')}</h2>
        <p className="mt-1 text-sm text-panel-muted dark:text-panel-muted-dark">
          {t('postDevice.subtitle')}
        </p>
      </div>

      <div className="max-w-xs">
        <label className="label">{t('postDevice.mqttPrefix')}</label>
        <input
          className="input font-mono"
          value={mqttPrefix}
          onChange={(e) => {
            formDirty.current = true;
            setMqttPrefix(e.target.value);
          }}
          disabled={!canEdit}
          placeholder="washpro"
        />
      </div>

      <form onSubmit={handlePricesSubmit} className="space-y-4">
        <h3 className="text-sm font-medium">{t('postDevice.modePrices', { symbol: currency.symbol || currency.code })}</h3>
        {!pricesLoaded && !settings?.pricesSyncedAt && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {t('postDevice.pricesHintStart')}{' '}
            <code className="text-xs">set/prices</code> {t('postDevice.pricesHintEnd')}
          </p>
        )}
        {settings?.pricesSyncedAt && (
          <p className="text-xs text-panel-muted">
            {t('postDevice.syncedFromDevice')}:{' '}
            {new Date(settings.pricesSyncedAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
            {settings.pricesUpdatedAt && (
              <> · {t('postDevice.syncedFromCrm')}: {new Date(settings.pricesUpdatedAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}</>
            )}
          </p>
        )}
        {sortedModes.length === 0 ? (
          <p className="text-sm text-panel-muted">{t('postDevice.modesNotLoaded')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedModes.map((mode) => {
              const readonly = isModePriceReadonly(mode.code);
              return (
              <div key={mode.id}>
                <label className="label">
                  {mode.code} — {mode.name}
                  {readonly && (
                    <span className="ml-1 text-xs font-normal text-panel-muted">({t('postDevice.readonly')})</span>
                  )}
                </label>
                <input
                  className="input font-mono"
                  type="number"
                  min={0}
                  step="0.01"
                  value={prices[String(mode.code)] ?? ''}
                  placeholder="—"
                  onChange={(e) => setPrice(String(mode.code), e.target.value)}
                  disabled={!canEdit || readonly}
                  readOnly={readonly}
                  title={readonly ? t('postDevice.priceReadonlyTitle') : undefined}
                />
              </div>
            );
            })}
          </div>
        )}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendToDevice}
                onChange={(e) => {
                  formDirty.current = true;
                  setSendToDevice(e.target.checked);
                }}
              />
              {t('postDevice.sendToPost')}
            </label>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={pullBusy || pricesBusy}
              onClick={() => void pullPricesFromMqtt()}
            >
              {pullBusy ? t('common.loading') : t('postDevice.pullFromMqtt')}
            </button>
          </div>
        )}
        {pricesErr && <ErrorMessage message={pricesErr} />}
        {pricesMsg && <p className="text-sm text-emerald-600">{pricesMsg}</p>}
        {canEdit && (
          <button type="submit" className="btn-primary" disabled={pricesBusy}>
            {pricesBusy ? t('common.saving') : t('postDevice.savePrices')}
          </button>
        )}
      </form>

      <form onSubmit={handleCommandSubmit} className="space-y-4 border-t border-panel-border pt-6 dark:border-panel-border-dark">
        <h3 className="text-sm font-medium">{t('postDevice.commandsTitle')}</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="label">{t('postDevice.commandLabel')}</label>
            <select
              className="input"
              value={command}
              onChange={(e) => setCommand(e.target.value as DeviceCommandKey)}
              disabled={!canEdit || commandBusy}
            >
              {deviceCommandOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {commandNeedsAmount(command) && (
            <div className="w-40">
              <label className="label">{t('postDevice.amountLabel', { symbol: currency.symbol || currency.code })}</label>
              <input
                className="input font-mono"
                type="number"
                min={0.01}
                step="0.01"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                disabled={!canEdit || commandBusy}
                required
              />
            </div>
          )}
          {canEdit && (
            <button type="submit" className="btn-secondary" disabled={commandBusy}>
              {commandBusy ? t('postDevice.sending') : t('postDevice.execute')}
            </button>
          )}
        </div>
        {settings?.lastCommand && settings.lastCommandAt && (
          <p className="text-xs text-panel-muted">
            {t('postDevice.lastCommand')}:{' '}
            {deviceCommandOptions.find((o) => o.value === settings.lastCommand)?.label || settings.lastCommand}{' '}
            ({new Date(settings.lastCommandAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')})
          </p>
        )}
        {commandErr && <ErrorMessage message={commandErr} />}
        {commandMsg && <p className="text-sm text-emerald-600">{commandMsg}</p>}
      </form>
    </section>
  );
}
