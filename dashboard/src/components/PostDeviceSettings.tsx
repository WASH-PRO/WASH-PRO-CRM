import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiListPage } from '../api/client';
import { sendPostCommand, sendPostPrices } from '../api/postDevice';
import { useWorkModes } from '../hooks/useWorkModes';
import { useCurrency } from '../hooks/useCurrency';
import { ErrorMessage } from './UI';
import type { PostSettings } from '../types';
import {
  commandNeedsAmount,
  DEVICE_COMMAND_OPTIONS,
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

  useEffect(() => {
    setMqttPrefix(settings?.mqttPrefix || 'washpro');
    setPrices(parseModePrices(settings?.modePrices));
  }, [settings?.mqttPrefix, settings?.modePrices, serialNumber]);

  const setPrice = (code: string, value: string) => {
    if (isModePriceReadonly(code)) return;
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
      }>('/crm/telemetry', 1, 200);
      const row = data.find(
        (r) =>
          r.postSerial === serialNumber &&
          r.messageType === 'prices' &&
          r.payload?.direction !== 'outbound'
      );
      if (!row) {
        setPricesErr(
          'В журнале MQTT нет цен с этого поста. Панель должна опубликовать set/prices (ключи price0…price9 или 0…9).'
        );
        return;
      }
      const parsed = parseModePrices(row.payload);
      if (!hasModePrices(parsed)) {
        setPricesErr(
          `Сообщение найдено, но формат не распознан: ${JSON.stringify(row.payload).slice(0, 120)}`
        );
        return;
      }
      setPrices(parsed);
      setPricesMsg(`Подтянуто из MQTT (${new Date(row.receivedAt || '').toLocaleString('ru')}). Нажмите «Сохранить цены», чтобы записать в CRM.`);
    } catch (err) {
      setPricesErr(err instanceof Error ? err.message : 'Не удалось загрузить из MQTT');
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
      const sent = result.topic ? ` Топик: ${result.topic}.` : ' Только в CRM.';
      setPricesMsg(`Цены сохранены.${sent}`);
      onSaved?.();
    } catch (err) {
      setPricesErr(err instanceof Error ? err.message : 'Не удалось сохранить цены');
    } finally {
      setPricesBusy(false);
    }
  };

  const handleCommandSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const label = DEVICE_COMMAND_OPTIONS.find((o) => o.value === command)?.label || command;
    if (!confirm(`Выполнить команду «${label}» на посте ${serialNumber}?`)) return;

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
      setCommandMsg(`Команда отправлена (${result.topic}).`);
      onSaved?.();
    } catch (err) {
      setCommandErr(err instanceof Error ? err.message : 'Не удалось отправить команду');
    } finally {
      setCommandBusy(false);
    }
  };

  return (
    <section id="device-settings" className="card mb-6 space-y-6 scroll-mt-4">
      <div>
        <h2 className="font-semibold">Настройки устройства</h2>
        <p className="mt-1 text-sm text-panel-muted dark:text-panel-muted-dark">
          Цены режимов и команды панели — как в меню на посту. Отправка через MQTT.
        </p>
      </div>

      <div className="max-w-xs">
        <label className="label">Префикс MQTT (dt_pref)</label>
        <input
          className="input font-mono"
          value={mqttPrefix}
          onChange={(e) => setMqttPrefix(e.target.value)}
          disabled={!canEdit}
          placeholder="washpro"
        />
      </div>

      <form onSubmit={handlePricesSubmit} className="space-y-4">
        <h3 className="text-sm font-medium">Цены режимов ({currency.symbol})</h3>
        {!pricesLoaded && !settings?.pricesSyncedAt && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Цены ещё не приходили с поста в CRM. Поля пустые — это не нули на устройстве. Задайте вручную,
            нажмите «Подтянуть из MQTT» или дождитесь публикации <code className="text-xs">set/prices</code> с панели.
          </p>
        )}
        {settings?.pricesSyncedAt && (
          <p className="text-xs text-panel-muted">
            С устройства: {new Date(settings.pricesSyncedAt).toLocaleString('ru')}
            {settings.pricesUpdatedAt && (
              <> · из CRM: {new Date(settings.pricesUpdatedAt).toLocaleString('ru')}</>
            )}
          </p>
        )}
        {sortedModes.length === 0 ? (
          <p className="text-sm text-panel-muted">Справочник режимов не загружен.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedModes.map((mode) => {
              const readonly = isModePriceReadonly(mode.code);
              return (
              <div key={mode.id}>
                <label className="label">
                  {mode.code} — {mode.name}
                  {readonly && (
                    <span className="ml-1 text-xs font-normal text-panel-muted">(только чтение)</span>
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
                  title={readonly ? 'Цена задаётся только на устройстве' : undefined}
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
                onChange={(e) => setSendToDevice(e.target.checked)}
              />
              Отправить на пост после сохранения в CRM
            </label>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={pullBusy || pricesBusy}
              onClick={() => void pullPricesFromMqtt()}
            >
              {pullBusy ? 'Загрузка…' : 'Подтянуть из MQTT'}
            </button>
          </div>
        )}
        {pricesErr && <ErrorMessage message={pricesErr} />}
        {pricesMsg && <p className="text-sm text-emerald-600">{pricesMsg}</p>}
        {canEdit && (
          <button type="submit" className="btn-primary" disabled={pricesBusy}>
            {pricesBusy ? 'Сохранение…' : 'Сохранить цены'}
          </button>
        )}
      </form>

      <form onSubmit={handleCommandSubmit} className="space-y-4 border-t border-panel-border pt-6 dark:border-panel-border-dark">
        <h3 className="text-sm font-medium">Команды устройства</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="label">Команда</label>
            <select
              className="input"
              value={command}
              onChange={(e) => setCommand(e.target.value as DeviceCommandKey)}
              disabled={!canEdit || commandBusy}
            >
              {DEVICE_COMMAND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {commandNeedsAmount(command) && (
            <div className="w-40">
              <label className="label">Сумма ({currency.symbol})</label>
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
              {commandBusy ? 'Отправка…' : 'Выполнить'}
            </button>
          )}
        </div>
        {settings?.lastCommand && settings.lastCommandAt && (
          <p className="text-xs text-panel-muted">
            Последняя команда: {DEVICE_COMMAND_OPTIONS.find((o) => o.value === settings.lastCommand)?.label || settings.lastCommand}{' '}
            ({new Date(settings.lastCommandAt).toLocaleString('ru')})
          </p>
        )}
        {commandErr && <ErrorMessage message={commandErr} />}
        {commandMsg && <p className="text-sm text-emerald-600">{commandMsg}</p>}
      </form>
    </section>
  );
}
