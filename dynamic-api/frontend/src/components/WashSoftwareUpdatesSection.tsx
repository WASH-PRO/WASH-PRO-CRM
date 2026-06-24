import { UpdateStatus } from '../types';

interface Props {
  updateStatus: UpdateStatus | null;
}

/** Software Updates block for WASH-PHO-CRM (vendored Dynamic API, in-app updater disabled). */
export default function WashSoftwareUpdatesSection({ updateStatus }: Props) {
  const version = updateStatus?.currentVersion ?? '—';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-950/40">
        <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">WASH-PHO-CRM — встроенная платформа</p>
        <p className="mt-2 text-sm text-sky-800/90 dark:text-sky-200/90">
          Dynamic API Platform поставляется как часть репозитория WASH. Обновление через панель (in-app updater)
          отключено — иначе может повредить vendored-копию и Docker-стек CRM.
        </p>
        <div className="mt-3 flex justify-between border-t border-sky-200/80 pt-3 text-sm dark:border-sky-800">
          <span className="text-slate-500">Установленная версия</span>
          <span className="font-mono font-medium text-slate-800 dark:text-slate-100">v{version}</span>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Как обновить платформу</p>
        <pre className="code-block whitespace-pre-wrap text-xs">{`cd WASH-PHO-CRM
./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel
./scripts/run-init-seed.sh   # при изменениях схемы API`}</pre>
        <p className="mt-2 text-xs text-slate-500">
          Подробнее: <span className="font-mono">docs/deployment.md</span>,{' '}
          <span className="font-mono">docs/architecture.md</span>
        </p>
      </div>
    </div>
  );
}
