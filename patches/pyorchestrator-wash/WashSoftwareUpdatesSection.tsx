import Panel from "@/components/ui/Panel";
import { api } from "@/api/client";
import { useTranslation } from "@/context/LocaleContext";
import { ArrowUpCircleIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

/** Software Updates block for WASH-PRO-CRM (vendored PyOrchestrator, in-app updater disabled). */
export default function WashSoftwareUpdatesSection() {
  const { locale } = useTranslation();
  const [version, setVersion] = useState("—");

  useEffect(() => {
    api<{ current_version: string }>("/api/v1/updates/status")
      .then((data) => setVersion(data.current_version || "—"))
      .catch(() => {});
  }, []);

  const isRu = locale === "ru";

  return (
    <Panel
      title={isRu ? "Обновления платформы" : "Platform updates"}
      subtitle={
        isRu
          ? "PyOrchestrator в составе WASH PRO CRM"
          : "PyOrchestrator embedded in WASH PRO CRM"
      }
      className="md:col-span-2 xl:col-span-3"
      bodyClassName="space-y-5"
      action={<ArrowUpCircleIcon className="size-5 text-faint" aria-hidden />}
    >
      <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-4 sm:p-5">
        <p className="text-sm font-semibold text-foreground">
          {isRu ? "WASH PRO CRM — встроенный модуль" : "WASH PRO CRM — embedded module"}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {isRu
            ? "PyOrchestrator поставляется как vendored-копия в репозитории WASH. Обновление через панель (OTA / in-app updater) отключено — иначе может повредить интеграцию с CRM, патчи WASH и Docker-стек."
            : "PyOrchestrator is vendored inside the WASH repository. In-panel OTA updates are disabled to protect WASH patches, CRM integration, and the Docker stack."}
        </p>
        <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm">
          <span className="text-faint">{isRu ? "Установленная версия" : "Installed version"}</span>
          <span className="font-mono font-medium text-foreground">v{version}</span>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">
          {isRu ? "Как обновить модуль" : "How to update the module"}
        </p>
        <pre className="overflow-x-auto rounded-xl border border-line bg-canvas/60 p-4 font-mono text-xs leading-relaxed text-muted whitespace-pre-wrap">
          {`cd WASH-PRO-CRM
./scripts/update-pyorchestrator.sh
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-backend pyorchestrator-panel pyorch-bridge pyorch-runtime pyorch-scheduler`}
        </pre>
        <p className="mt-2 text-xs text-faint">
          {isRu ? "Подробнее:" : "See:"}{" "}
          <span className="font-mono text-muted">docs/deployment.md</span>,{" "}
          <span className="font-mono text-muted">docs/embedded-services.md</span>
        </p>
      </div>
    </Panel>
  );
}
