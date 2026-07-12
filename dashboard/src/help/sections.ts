export type HelpMockupId =
  | 'dashboard'
  | 'states'
  | 'system'
  | 'table'
  | 'postDetail'
  | 'mqtt'
  | 'cards'
  | 'analytics'
  | 'settings'
  | 'telegram'
  | 'notifications'
  | 'users';

export interface HelpSectionDef {
  id: string;
  groupKey: string;
  mockup: HelpMockupId;
  adminOnly?: boolean;
}

export const HELP_SECTIONS: HelpSectionDef[] = [
  { id: 'navigation', groupKey: 'main', mockup: 'dashboard' },
  { id: 'dashboard', groupKey: 'main', mockup: 'dashboard' },
  { id: 'states', groupKey: 'main', mockup: 'states' },
  { id: 'washes', groupKey: 'objects', mockup: 'table' },
  { id: 'posts', groupKey: 'objects', mockup: 'table' },
  { id: 'postDetail', groupKey: 'objects', mockup: 'postDetail' },
  { id: 'mqtt', groupKey: 'data', mockup: 'mqtt' },
  { id: 'cardsDiscount', groupKey: 'cards', mockup: 'cards' },
  { id: 'cardsService', groupKey: 'cards', mockup: 'cards' },
  { id: 'cardsVip', groupKey: 'cards', mockup: 'cards' },
  { id: 'cardsCollection', groupKey: 'cards', mockup: 'cards' },
  { id: 'usage', groupKey: 'analytics', mockup: 'analytics' },
  { id: 'finance', groupKey: 'analytics', mockup: 'analytics' },
  { id: 'archive', groupKey: 'analytics', mockup: 'analytics' },
  { id: 'workModes', groupKey: 'references', mockup: 'table', adminOnly: true },
  { id: 'currency', groupKey: 'references', mockup: 'table', adminOnly: true },
  { id: 'discountTypes', groupKey: 'references', mockup: 'table', adminOnly: true },
  { id: 'infoMessages', groupKey: 'automation', mockup: 'table', adminOnly: true },
  { id: 'telegram', groupKey: 'automation', mockup: 'telegram', adminOnly: true },
  { id: 'mcp', groupKey: 'automation', mockup: 'settings', adminOnly: true },
  { id: 'modules', groupKey: 'automation', mockup: 'settings', adminOnly: true },
  { id: 'backups', groupKey: 'automation', mockup: 'table', adminOnly: true },
  { id: 'system', groupKey: 'system', mockup: 'system' },
  { id: 'notifications', groupKey: 'system', mockup: 'notifications' },
  { id: 'users', groupKey: 'system', mockup: 'users', adminOnly: true },
  { id: 'groups', groupKey: 'system', mockup: 'users', adminOnly: true },
  { id: 'settings', groupKey: 'system', mockup: 'settings' },
  { id: 'setup', groupKey: 'system', mockup: 'settings', adminOnly: true },
  { id: 'welcome', groupKey: 'main', mockup: 'dashboard' },
  { id: 'profile', groupKey: 'system', mockup: 'users' },
  { id: 'logs', groupKey: 'system', mockup: 'table', adminOnly: true },
];
