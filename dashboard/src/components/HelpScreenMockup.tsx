import clsx from 'clsx';
import type { HelpMockupId } from '../help/sections';

interface Region {
  id: string;
  label: string;
  className: string;
}

export const HELP_MOCKUPS: Record<HelpMockupId, Region[]> = {
  dashboard: [
    { id: 'kpi', label: '1', className: 'left-[4%] top-[14%] h-[18%] w-[28%]' },
    { id: 'revenue', label: '2', className: 'left-[36%] top-[14%] h-[18%] w-[28%]' },
    { id: 'workload', label: '3', className: 'left-[68%] top-[14%] h-[18%] w-[28%]' },
    { id: 'charts', label: '4', className: 'left-[4%] top-[38%] h-[38%] w-[60%]' },
    { id: 'feed', label: '5', className: 'left-[68%] top-[38%] h-[38%] w-[28%]' },
  ],
  states: [
    { id: 'grid', label: '1', className: 'left-[4%] top-[14%] h-[52%] w-[92%]' },
    { id: 'chart', label: '2', className: 'left-[4%] top-[72%] h-[22%] w-[92%]' },
  ],
  system: [
    { id: 'app', label: '1', className: 'left-[4%] top-[14%] h-[22%] w-[44%]' },
    { id: 'components', label: '2', className: 'left-[52%] top-[14%] h-[22%] w-[44%]' },
    { id: 'metrics', label: '3', className: 'left-[4%] top-[42%] h-[52%] w-[92%]' },
  ],
  table: [
    { id: 'toolbar', label: '1', className: 'left-[4%] top-[12%] h-[10%] w-[92%]' },
    { id: 'table', label: '2', className: 'left-[4%] top-[26%] h-[58%] w-[92%]' },
    { id: 'pager', label: '3', className: 'left-[4%] top-[88%] h-[8%] w-[92%]' },
  ],
  postDetail: [
    { id: 'status', label: '1', className: 'left-[4%] top-[12%] h-[14%] w-[44%]' },
    { id: 'commands', label: '2', className: 'left-[52%] top-[12%] h-[14%] w-[44%]' },
    { id: 'prices', label: '3', className: 'left-[4%] top-[32%] h-[28%] w-[92%]' },
    { id: 'journal', label: '4', className: 'left-[4%] top-[66%] h-[28%] w-[92%]' },
  ],
  mqtt: [
    { id: 'accounts', label: '1', className: 'left-[4%] top-[14%] h-[35%] w-[44%]' },
    { id: 'crm', label: '2', className: 'left-[52%] top-[14%] h-[35%] w-[44%]' },
    { id: 'sync', label: '3', className: 'left-[4%] top-[56%] h-[18%] w-[92%]' },
  ],
  cards: [
    { id: 'tabs', label: '1', className: 'left-[4%] top-[10%] h-[8%] w-[92%]' },
    { id: 'list', label: '2', className: 'left-[4%] top-[22%] h-[50%] w-[92%]' },
    { id: 'log', label: '3', className: 'left-[4%] top-[76%] h-[18%] w-[92%]' },
  ],
  analytics: [
    { id: 'filters', label: '1', className: 'left-[4%] top-[12%] h-[10%] w-[92%]' },
    { id: 'chart', label: '2', className: 'left-[4%] top-[26%] h-[45%] w-[92%]' },
    { id: 'table', label: '3', className: 'left-[4%] top-[75%] h-[20%] w-[92%]' },
  ],
  settings: [
    { id: 'language', label: '1', className: 'left-[4%] top-[10%] h-[12%] w-[92%]' },
    { id: 'sections', label: '2', className: 'left-[4%] top-[26%] h-[55%] w-[92%]' },
    { id: 'updates', label: '3', className: 'left-[4%] top-[84%] h-[12%] w-[92%]' },
  ],
  telegram: [
    { id: 'bots', label: '1', className: 'left-[4%] top-[12%] h-[40%] w-[92%]' },
    { id: 'actions', label: '2', className: 'left-[4%] top-[58%] h-[14%] w-[92%]' },
    { id: 'qr', label: '3', className: 'left-[4%] top-[76%] h-[18%] w-[44%]' },
  ],
  notifications: [
    { id: 'filters', label: '1', className: 'left-[4%] top-[12%] h-[10%] w-[92%]' },
    { id: 'list', label: '2', className: 'left-[4%] top-[26%] h-[62%] w-[92%]' },
  ],
  users: [
    { id: 'users', label: '1', className: 'left-[4%] top-[12%] h-[38%] w-[92%]' },
    { id: 'groups', label: '2', className: 'left-[4%] top-[56%] h-[38%] w-[92%]' },
  ],
};

export function HelpScreenMockup({
  mockup,
  regionLabels,
}: {
  mockup: HelpMockupId;
  regionLabels: Record<string, string>;
}) {
  const regions = HELP_MOCKUPS[mockup];

  return (
    <div className="overflow-hidden rounded-xl border border-panel-border bg-gradient-to-br from-slate-100 to-slate-200/80 shadow-inner dark:border-panel-border-dark dark:from-slate-900 dark:to-slate-800/80">
      <div className="border-b border-panel-border/60 bg-white/70 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-panel-muted dark:border-panel-border-dark dark:bg-slate-950/40">
        WASH PRO CRM
      </div>
      <div className="relative aspect-[16/10] w-full min-h-[200px]">
        <div className="absolute bottom-0 left-0 top-0 w-[14%] border-r border-panel-border/50 bg-white/50 dark:bg-slate-950/30" />
        <div className="absolute bottom-0 left-[14%] right-0 top-0 bg-white/30 dark:bg-slate-950/20">
          <div className="h-[10%] border-b border-panel-border/40 bg-white/60 dark:bg-slate-900/50" />
          {regions.map((r) => (
            <div
              key={r.id}
              className={clsx(
                'absolute rounded-md border-2 border-dashed border-brand-500/70 bg-brand-500/15 shadow-sm',
                r.className
              )}
            >
              <span className="absolute -left-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[9px] font-bold text-white">
                {r.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      <ul className="grid gap-1 border-t border-panel-border/60 bg-panel-card/80 px-3 py-2 text-[11px] dark:border-panel-border-dark dark:bg-panel-card-dark/80 sm:grid-cols-2">
        {regions.map((r) => (
          <li key={r.id} className="flex gap-1.5 text-panel-muted dark:text-panel-muted-dark">
            <span className="font-semibold text-brand-600 dark:text-brand-400">{r.label}.</span>
            <span>{regionLabels[r.id] ?? r.id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
