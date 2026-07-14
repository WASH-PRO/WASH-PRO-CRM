import { createApp } from './app';
import { connectDatabase } from './config/database';
import { scheduleDatabaseIndexSync } from './config/indexes';
import { env } from './config/env';
import { seedDatabase } from './seed';
import { settingsService } from './services/settings.service';
import { cronScheduler } from './services/cron.service';
import { updateScheduler } from './services/update-scheduler.service';
import { updateSettingsService } from './services/update-settings.service';

async function main(): Promise<void> {
  await connectDatabase();
  await seedDatabase();
  await settingsService.load();
  await updateSettingsService.seedDefaults();

  const app = createApp();
  await cronScheduler.start();
  await updateScheduler.start();

  app.listen(env.port, () => {
    console.log(`Dynamic API Platform backend running on port ${env.port}`);
    console.log(`Environment: ${env.nodeEnv}`);
    console.log(`Admin login: ${env.adminLogin}`);
    scheduleDatabaseIndexSync();
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
