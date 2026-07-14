import {
  ApiKey,
  CronJob,
  Endpoint,
  EndpointData,
  EndpointGroup,
  Group,
  Log,
  SystemSettings,
  UpdateJob,
  User,
  Webhook,
} from '../models';

const MODELS = [
  User,
  Group,
  EndpointGroup,
  Endpoint,
  EndpointData,
  Log,
  SystemSettings,
  CronJob,
  Webhook,
  ApiKey,
  UpdateJob,
] as const;

/** Создаёт индексы из схем Mongoose (важно для NODE_ENV=production). */
export async function syncDatabaseIndexes(): Promise<void> {
  console.log('Syncing MongoDB indexes…');
  for (const model of MODELS) {
    await model.syncIndexes();
    console.log(`MongoDB indexes synced: ${model.modelName}`);
  }
  console.log('MongoDB index sync complete');
}

/** Не блокирует старт API — индексы строятся параллельно с healthcheck при обновлении. */
export function scheduleDatabaseIndexSync(): void {
  void syncDatabaseIndexes().catch((error) => {
    console.error('Background MongoDB index sync failed:', error);
  });
}
