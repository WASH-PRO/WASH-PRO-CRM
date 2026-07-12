export interface BreadcrumbItem {
  label: string;
  path?: string;
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

interface BreadcrumbTrailEntry {
  labelKey: string;
  path?: string;
}

interface RouteBreadcrumbDef {
  path: string;
  trail: BreadcrumbTrailEntry[];
}

const ROUTE_BREADCRUMBS: RouteBreadcrumbDef[] = [
  { path: '/states', trail: [{ labelKey: 'nav.groups.main' }, { labelKey: 'nav.items.states', path: '/states' }] },
  { path: '/washes', trail: [{ labelKey: 'nav.groups.objects' }, { labelKey: 'nav.items.washes', path: '/washes' }] },
  { path: '/posts', trail: [{ labelKey: 'nav.groups.objects' }, { labelKey: 'nav.items.posts', path: '/posts' }] },
  { path: '/mqtt', trail: [{ labelKey: 'nav.groups.data' }, { labelKey: 'nav.items.mqtt', path: '/mqtt' }] },
  {
    path: '/cards/discount',
    trail: [{ labelKey: 'nav.groups.cards' }, { labelKey: 'nav.items.cardsDiscount', path: '/cards/discount' }],
  },
  {
    path: '/cards/service',
    trail: [{ labelKey: 'nav.groups.cards' }, { labelKey: 'nav.items.cardsService', path: '/cards/service' }],
  },
  {
    path: '/cards/vip',
    trail: [{ labelKey: 'nav.groups.cards' }, { labelKey: 'nav.items.cardsVip', path: '/cards/vip' }],
  },
  {
    path: '/cards/collection',
    trail: [{ labelKey: 'nav.groups.cards' }, { labelKey: 'nav.items.cardsCollection', path: '/cards/collection' }],
  },
  {
    path: '/cards',
    trail: [{ labelKey: 'nav.groups.cards' }, { labelKey: 'nav.items.cardsDiscount', path: '/cards/discount' }],
  },
  { path: '/usage', trail: [{ labelKey: 'nav.groups.analytics' }, { labelKey: 'nav.items.usage', path: '/usage' }] },
  { path: '/finance', trail: [{ labelKey: 'nav.groups.analytics' }, { labelKey: 'nav.items.finance', path: '/finance' }] },
  { path: '/archive', trail: [{ labelKey: 'nav.groups.analytics' }, { labelKey: 'nav.items.archive', path: '/archive' }] },
  {
    path: '/work-modes',
    trail: [{ labelKey: 'nav.groups.references' }, { labelKey: 'nav.items.workModes', path: '/work-modes' }],
  },
  {
    path: '/currency',
    trail: [{ labelKey: 'nav.groups.references' }, { labelKey: 'nav.items.currency', path: '/currency' }],
  },
  {
    path: '/discount-types',
    trail: [{ labelKey: 'nav.groups.references' }, { labelKey: 'nav.items.discountTypes', path: '/discount-types' }],
  },
  {
    path: '/info-messages',
    trail: [{ labelKey: 'nav.groups.automation' }, { labelKey: 'nav.items.infoMessages', path: '/info-messages' }],
  },
  {
    path: '/telegram',
    trail: [{ labelKey: 'nav.groups.automation' }, { labelKey: 'nav.items.telegram', path: '/telegram' }],
  },
  { path: '/mcp', trail: [{ labelKey: 'nav.groups.automation' }, { labelKey: 'nav.items.mcp', path: '/mcp' }] },
  {
    path: '/modules',
    trail: [{ labelKey: 'nav.groups.automation' }, { labelKey: 'nav.items.modules', path: '/modules' }],
  },
  {
    path: '/backups',
    trail: [{ labelKey: 'nav.groups.automation' }, { labelKey: 'nav.items.backups', path: '/backups' }],
  },
  { path: '/system', trail: [{ labelKey: 'nav.groups.system' }, { labelKey: 'nav.items.system', path: '/system' }] },
  {
    path: '/notifications',
    trail: [{ labelKey: 'nav.groups.system' }, { labelKey: 'nav.items.notifications', path: '/notifications' }],
  },
  { path: '/users', trail: [{ labelKey: 'nav.groups.system' }, { labelKey: 'nav.items.users', path: '/users' }] },
  { path: '/groups', trail: [{ labelKey: 'nav.groups.system' }, { labelKey: 'nav.items.groups', path: '/groups' }] },
  {
    path: '/settings',
    trail: [{ labelKey: 'nav.groups.system' }, { labelKey: 'nav.items.settings', path: '/settings' }],
  },
  { path: '/logs', trail: [{ labelKey: 'nav.groups.system' }, { labelKey: 'nav.items.logs', path: '/logs' }] },
  { path: '/profile', trail: [{ labelKey: 'breadcrumbs.profile', path: '/profile' }] },
];

const ROUTE_BY_PATH = new Map(ROUTE_BREADCRUMBS.map((route) => [route.path, route]));

const POST_DETAIL_RE = /^\/posts\/[^/]+$/;
const MODULE_DETAIL_RE = /^\/modules\/[^/]+$/;

function buildTrail(trail: BreadcrumbTrailEntry[], t: TranslateFn): BreadcrumbItem[] {
  return trail.map((entry, index) => ({
    label: t(entry.labelKey),
    path: index < trail.length - 1 ? entry.path : undefined,
  }));
}

export function breadcrumbsFromPath(pathname: string, t: TranslateFn): BreadcrumbItem[] {
  const normalized = pathname.replace(/\/+$/, '') || '/';

  if (normalized === '/') {
    return [{ label: t('nav.items.dashboard') }];
  }

  if (POST_DETAIL_RE.test(normalized)) {
    return buildTrail(
      [
        { labelKey: 'nav.groups.objects' },
        { labelKey: 'nav.items.posts', path: '/posts' },
        { labelKey: 'breadcrumbs.post' },
      ],
      t
    );
  }

  if (MODULE_DETAIL_RE.test(normalized)) {
    return buildTrail(
      [
        { labelKey: 'nav.groups.automation' },
        { labelKey: 'nav.items.modules', path: '/modules' },
        { labelKey: 'breadcrumbs.module' },
      ],
      t
    );
  }

  const route = ROUTE_BY_PATH.get(normalized);
  if (route) {
    return buildTrail(route.trail, t);
  }

  return [{ label: t('nav.items.dashboard'), path: '/' }];
}
