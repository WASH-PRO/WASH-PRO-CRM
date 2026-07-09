const ROUTE_LABEL_KEYS: Record<string, string> = {
  '': 'breadcrumbs.dashboard',
  washes: 'breadcrumbs.washes',
  posts: 'breadcrumbs.posts',
  states: 'breadcrumbs.states',
  mqtt: 'breadcrumbs.mqtt',
  cards: 'breadcrumbs.cards',
  discount: 'breadcrumbs.discount',
  service: 'breadcrumbs.service',
  vip: 'breadcrumbs.vip',
  collection: 'breadcrumbs.collection',
  usage: 'breadcrumbs.usage',
  finance: 'breadcrumbs.finance',
  archive: 'breadcrumbs.archive',
  notifications: 'breadcrumbs.notifications',
  users: 'breadcrumbs.users',
  groups: 'breadcrumbs.groups',
  backups: 'breadcrumbs.backups',
  telegram: 'breadcrumbs.telegram',
  mcp: 'breadcrumbs.mcp',
  'info-messages': 'breadcrumbs.infoMessages',
  currency: 'breadcrumbs.currency',
  'discount-types': 'breadcrumbs.discountTypes',
  'work-modes': 'breadcrumbs.workModes',
  settings: 'breadcrumbs.settings',
  profile: 'breadcrumbs.profile',
  logs: 'breadcrumbs.logs',
};

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

function segmentLabel(segment: string, prevSegment: string | undefined, t: TranslateFn): string {
  if (prevSegment === 'posts' && OBJECT_ID_RE.test(segment)) {
    return t('breadcrumbs.post');
  }
  return t(ROUTE_LABEL_KEYS[segment] ?? segment);
}

export function breadcrumbsFromPath(pathname: string, t: TranslateFn): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return [{ label: t('breadcrumbs.dashboard') }];
  }

  const items: BreadcrumbItem[] = [{ label: t('breadcrumbs.dashboard'), path: '/' }];
  let acc = '';

  for (let i = 0; i < segments.length; i++) {
    acc += `/${segments[i]}`;
    const label = segmentLabel(segments[i]!, segments[i - 1], t);
    const isLast = i === segments.length - 1;
    items.push({ label, path: isLast ? undefined : acc });
  }

  return items;
}
