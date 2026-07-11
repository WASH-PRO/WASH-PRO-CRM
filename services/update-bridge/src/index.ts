import { pino } from 'pino';
import { startUpdateHttpServer } from './http.js';
import { scheduleBackgroundChecks } from './jobs.js';
import { ensureGitSafeDirectory } from './repair.js';
import { loadState, recoverInterruptedJobs, saveState } from './state.js';

const logger = pino({ level: 'info' });

async function main(): Promise<void> {
  await loadState();
  if (recoverInterruptedJobs()) {
    await saveState();
    logger.warn('Прерванные задачи обновления сброшены после рестарта');
  }
  try {
    await ensureGitSafeDirectory();
  } catch {
    // non-fatal — repair wizard can fix
  }
  startUpdateHttpServer();
  scheduleBackgroundChecks();
  logger.info('Update bridge started');
}

main().catch((err) => {
  logger.error({ err }, 'Update bridge failed to start');
  process.exit(1);
});
