import { logRepository } from '../repositories';
import { settingsService, AppSettings } from './settings.service';

export class SettingsManagementService {
  async getSettings(): Promise<AppSettings> {
    return settingsService.getAll();
  }

  async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    return settingsService.update(partial);
  }

  async clearAllLogs(): Promise<number> {
    return logRepository.deleteAll();
  }

  async clearOldLogs(): Promise<number> {
    const { logRetentionDays } = settingsService.getCached();
    return logRepository.deleteOlderThan(logRetentionDays);
  }

  async getLogsCount(): Promise<number> {
    return logRepository.count();
  }
}

export const settingsManagementService = new SettingsManagementService();
