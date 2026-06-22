import { createApp } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import { seedDatabase } from './seed';
import { settingsService } from './services/settings.service';

async function main(): Promise<void> {
  await connectDatabase();
  await seedDatabase();
  await settingsService.load();

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`Dynamic API Platform backend running on port ${env.port}`);
    console.log(`Environment: ${env.nodeEnv}`);
    console.log(`Admin login: ${env.adminLogin}`);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
