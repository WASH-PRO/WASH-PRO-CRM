import { useCallback, useEffect, useState } from 'react';
import { loadSetupSettings } from '../api/setup';
import type { SetupSettings } from '../types';

export function useSetupStatus() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SetupSettings>({ complete: false, skippedSteps: [] });
  const [settingId, setSettingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loadSetupSettings();
      setSettings(result.settings);
      setSettingId(result.settingId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить статус установки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { loading, settings, settingId, error, reload, setSettings, setSettingId };
}
