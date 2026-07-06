import { pino } from 'pino';
import { startUpdateHttpServer } from './http.js';
import { scheduleBackgroundChecks } from './jobs.js';
import { loadState } from './state.js';

const logger = pino({ level: 'info' });

async function main(): Promise<void> {
  await loadState();
  startUpdateHttpServer();
  scheduleBackgroundChecks();
  logger.info('Update bridge started');
}

main().catch((err) => {
  logger.error({ err }, 'Update bridge failed to start');
  process.exit(1);
});
