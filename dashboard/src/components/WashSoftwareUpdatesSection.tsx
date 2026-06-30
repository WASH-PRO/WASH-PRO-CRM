/** Инструкции по обновлению WASH-PRO-CRM (без in-app updater). */
export default function WashSoftwareUpdatesSection() {
  const version = import.meta.env.VITE_APP_VERSION || '—';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-800/60 dark:bg-sky-950/40">
        <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">WASH-PRO-CRM</p>
        <p className="mt-2 text-sm leading-relaxed text-sky-800/90 dark:text-sky-200/90">
          Платформа обновляется из git-репозитория и Docker Compose. In-app updater отключён — обновление выполняется
          скриптами на сервере.
        </p>
        <div className="mt-3 flex justify-between border-t border-sky-200/80 pt-3 text-sm dark:border-sky-800">
          <span className="text-panel-muted dark:text-panel-muted-dark">Версия dashboard</span>
          <span className="font-mono font-medium text-panel-ink dark:text-panel-ink-dark">v{version}</span>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-panel-ink dark:text-panel-ink-dark">Обновление CRM</p>
        <pre className="overflow-x-auto rounded-lg border border-panel-border bg-panel-canvas p-3 font-mono text-xs text-panel-ink dark:border-panel-border-dark dark:bg-[#0d1218] dark:text-panel-ink-dark">{`git pull
docker compose up -d --build`}</pre>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-panel-ink dark:text-panel-ink-dark">Обновление Dynamic API</p>
        <pre className="overflow-x-auto rounded-lg border border-panel-border bg-panel-canvas p-3 font-mono text-xs text-panel-ink dark:border-panel-border-dark dark:bg-[#0d1218] dark:text-panel-ink-dark">{`./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel
./scripts/run-init-seed.sh`}</pre>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-panel-ink dark:text-panel-ink-dark">Обновление PyOrchestrator</p>
        <pre className="overflow-x-auto rounded-lg border border-panel-border bg-panel-canvas p-3 font-mono text-xs text-panel-ink dark:border-panel-border-dark dark:bg-[#0d1218] dark:text-panel-ink-dark">{`./scripts/update-pyorchestrator.sh
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-backend pyorchestrator-panel`}</pre>
        <p className="mt-2 text-xs text-panel-muted dark:text-panel-muted-dark">
          Подробнее: <span className="font-mono">docs/deployment.md</span>
        </p>
      </div>
    </div>
  );
}
