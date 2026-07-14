import cron from 'node-cron';
import { pino } from 'pino';
import type { ArchiveGroupKey, ArchiveSettings } from './archive-settings.js';
import { DEFAULT_ARCHIVE_CRON } from './archive-settings.js';

const logger = pino({ level: 'info' });

export type ArchiveScheduleKey = 'telemetry' | ArchiveGroupKey;

interface ScheduledArchiveJob {
  cronExpr: string;
  task: cron.ScheduledTask;
}

const jobs = new Map<ArchiveScheduleKey, ScheduledArchiveJob>();

export function resolveArchiveCron(settings: ArchiveSettings, groupKey?: ArchiveGroupKey): string {
  const fallback = process.env.ARCHIVE_CRON?.trim() || DEFAULT_ARCHIVE_CRON;
  if (!groupKey) {
    return settings.cron?.trim() || fallback;
  }
  const group = settings[groupKey];
  return group?.cron?.trim() || fallback;
}

export function syncArchiveSchedules(
  settings: ArchiveSettings,
  handlers: Record<ArchiveScheduleKey, () => void | Promise<void>>
): void {
  const telemetryEnabled = settings.autoArchive !== false;
  if (telemetryEnabled) {
    scheduleArchiveJob('telemetry', resolveArchiveCron(settings), handlers.telemetry);
  } else {
    stopArchiveJob('telemetry');
  }

  for (const groupKey of ['cards', 'postStates', 'usageStats', 'financeStats'] as ArchiveGroupKey[]) {
    const group = settings[groupKey]!;
    if (group.enabled && group.autoRun) {
      scheduleArchiveJob(groupKey, resolveArchiveCron(settings, groupKey), handlers[groupKey]);
    } else {
      stopArchiveJob(groupKey);
    }
  }
}

function scheduleArchiveJob(
  key: ArchiveScheduleKey,
  cronExpr: string,
  handler: () => void | Promise<void>
): void {
  const existing = jobs.get(key);
  if (existing?.cronExpr === cronExpr) return;

  existing?.task.stop();

  if (!cron.validate(cronExpr)) {
    logger.warn({ key, cronExpr }, 'Invalid archive cron expression — job skipped');
    jobs.delete(key);
    return;
  }

  const task = cron.schedule(cronExpr, () => {
    void handler();
  });
  jobs.set(key, { cronExpr, task });
  logger.info({ key, cronExpr }, 'Archive schedule registered');
}

function stopArchiveJob(key: ArchiveScheduleKey): void {
  const existing = jobs.get(key);
  if (!existing) return;
  existing.task.stop();
  jobs.delete(key);
  logger.info({ key }, 'Archive schedule stopped');
}
