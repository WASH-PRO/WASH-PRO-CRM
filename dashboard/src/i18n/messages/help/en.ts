import type { HelpMessages } from './types';

export const helpEn = {
  title: 'WASH PRO CRM Help',
  close: 'Close help',
  open: 'Help',
  searchPlaceholder: 'Search section…',
  howItWorks: 'How it works',
  example: 'Example',
  onScreen: 'On screen',
  adminBadge: 'Administrator',
  docsLink: 'Full documentation on GitHub Pages',
  docsModulesLink: 'Modules documentation',
  moduleHelpIntro: 'Help is provided by the module author (`ui/help.html` / `ui/help.ru.html` in the module repository).',
  sections: {
    navigation: {
      title: 'Navigation and help',
      summary:
        'Sidebar footer: **Setup wizard** → **Help** → **Resources** (Documentation, GitHub). Breadcrumbs above the page.',
      howItWorks:
        'Menu groups: **Main** (Overview, Status), **Sites**, **Data**, **Cards**, **Analytics**, **References**, **Automation** (Publications, Telegram, MCP, Backups), **System** (Information about the server, Notifications, Users, Settings…). Breadcrumbs mirror group and section — e.g. “Analytics → Usage” or “System → Information”; the group is not clickable, parent sections are links. Help opens from the header: fullscreen modal, search, screen wireframes; close with ✕ or Esc.',
      example:
        'On Publications breadcrumbs show Automation → Publications. For bot hints open help and go to the Telegram section.',
      regions: {
        kpi: 'Sidebar footer: Help above Documentation',
        revenue: 'Breadcrumbs (group → section)',
        workload: 'Sidebar menu by groups',
        charts: 'Current page content',
        feed: 'Resources: Dynamic API, PyOrchestrator',
      },
    },
    dashboard: {
      title: 'Overview',
      summary:
        'Main KPI dashboard: revenue, post workload, latest notifications. Data refreshes in Live mode (header toggle).',
      howItWorks:
        'Dynamic API aggregates post telemetry via MQTT and MongoDB. Cards show the current period; charts show daily trends; the feed lists recent events.',
      example:
        'In the morning an operator opens Overview: sees yesterday’s revenue, peak load at 6 PM, and “Post 3 offline” — goes to Status.',
      regions: {
        kpi: 'KPI cards (revenue, sessions)',
        revenue: 'Daily revenue chart',
        workload: 'Workload chart',
        charts: 'Usage and payment pie charts',
        feed: 'Latest notifications feed',
      },
    },
    states: {
      title: 'Status',
      summary: 'All network posts: online/offline, mode, session timer, activity chart.',
      howItWorks:
        'Status comes from MQTT telemetry (`state/post`). The page polls the API every few seconds in Live mode. Click a post for details.',
      example: 'Dispatcher sees a post offline in red — calls the site or opens post details.',
      regions: {
        grid: 'Post grid with statuses',
        chart: 'Activity timeline chart',
      },
    },
    system: {
      title: 'Information',
      summary:
        'Server resources (CPU, memory, disk), CRM and component versions. In the **System** group (`/system`).',
      howItWorks:
        'Dynamic API reads `/proc`, Docker, and `update-bridge` for versions. Metrics refresh every 30 s. Breadcrumbs: System → Information.',
      example: 'Admin verifies CRM v1.1.22 and enough disk space in DATA_DIR for backups.',
      regions: {
        app: 'WASH PRO CRM application block',
        components: 'Dynamic API, PyOrchestrator versions',
        metrics: 'Host metrics and network',
      },
    },
    washes: {
      title: 'Car washes',
      summary: 'Site directory: name, address, linked posts.',
      howItWorks: 'CRUD via Dynamic API → MongoDB. Posts reference a wash. Delete only when no active posts.',
      example: 'Add “Wash on Main St” — then create posts with serials for controllers on that site.',
      regions: {
        toolbar: 'Create, refresh, search',
        table: 'Wash table',
        pager: 'Pagination',
      },
    },
    posts: {
      title: 'Posts',
      summary: 'Bays with serial, MQTT account, prices, and device settings.',
      howItWorks: 'Each post has a unique MQTT serial. On save, message-processor syncs Mosquitto passwd/ACL.',
      example: 'New post: serial `WP-001`, login `post001`, linked to a wash — controller connects to the broker.',
      regions: {
        toolbar: 'Create and filters',
        table: 'Post list',
        pager: 'Table pages',
      },
    },
    postDetail: {
      title: 'Post details',
      summary: 'Post control: commands, prices, journal, live telemetry.',
      howItWorks: 'Commands go to MQTT (`set/*`). Prices via message-processor. Journal — NFC and session events.',
      example: 'Operator sends “Stop program” and changes “Standard wash” price — device receives via MQTT.',
      regions: {
        status: 'Online, mode, timer',
        commands: 'Command buttons',
        prices: 'Price table',
        journal: 'Event journal',
      },
    },
    mqtt: {
      title: 'MQTT',
      summary: 'Post and CRM accounts, system password, ACL sync.',
      howItWorks:
        'CRM password (`system`) is set in Settings. Posts have separate logins. Sync recreates passwd/acl in DATA_DIR.',
      example: 'After changing MQTT_PASSWORD in Settings — save and wait for sync; posts reconnect with the new CRM password.',
      regions: {
        accounts: 'Post accounts',
        crm: 'CRM account (system)',
        sync: 'passwd/ACL sync',
      },
    },
    cardsDiscount: {
      title: 'Discount cards',
      summary: 'Customer cards with balance and discount type 1–5.',
      howItWorks: 'NFC events from posts create journal rows. Card type `regular`.',
      example: 'Customer taps card — journal shows “success”, balance decreases by program cost.',
      regions: {
        tabs: 'Card type tabs',
        list: 'Card list',
        log: 'NFC application log',
      },
    },
    cardsService: {
      title: 'Service cards',
      summary: 'Staff cards (`service`).',
      howItWorks: 'Like discount cards but for maintenance; separate from customer billing.',
      example: 'Technician opens bay with service card — event logged separately from customers.',
      regions: {
        tabs: 'Card type',
        list: 'Card list',
        log: 'Journal',
      },
    },
    cardsVip: {
      title: 'VIP cards',
      summary: 'Unlimited cards (`unlimited`).',
      howItWorks: 'Balance debit may be skipped depending on post discount type settings.',
      example: 'VIP customer uses lane — application shown in the journal.',
      regions: {
        tabs: 'VIP',
        list: 'Cards',
        log: 'Journal',
      },
    },
    cardsCollection: {
      title: 'Collection',
      summary: 'Cash collection events from posts.',
      howItWorks: 'Device sends cardType `collection` — CRM creates a notification, not a card row.',
      example: 'After collection, Usage and Finance “before/after” analytics split periods.',
      regions: {
        tabs: 'Collection',
        list: 'Events',
        log: 'Details',
      },
    },
    usage: {
      title: 'Usage',
      summary: 'Post runtime statistics before and after collection.',
      howItWorks: 'Aggregates `usage-stats` by regular/service/unlimited categories.',
      example: 'Compare load before/after weekly collection — see real customer traffic.',
      regions: {
        filters: 'Period and wash',
        chart: 'Usage chart',
        table: 'Per-post table',
      },
    },
    finance: {
      title: 'Finance',
      summary: 'Revenue: cash, cashless, discount, total.',
      howItWorks: 'Data from `finance-stats`, tied to posts and collection periods.',
      example: 'Monthly report: 60% cashless, 40% cash — export for accounting.',
      regions: {
        filters: 'Period filters',
        chart: 'Revenue charts',
        table: 'Breakdown table',
      },
    },
    archive: {
      title: 'Archive',
      summary: 'Archive policies and operation log.',
      howItWorks: 'Configurable rules by data group; old records moved or deleted on schedule.',
      example: 'Archive telemetry older than 90 days — MongoDB frees space.',
      regions: {
        filters: 'Policies',
        chart: 'Archive stats',
        table: 'Operation log',
      },
    },
    workModes: {
      title: 'Work modes',
      summary: 'Post program reference (program_1 … program_9).',
      howItWorks: 'Used in telemetry and Telegram bot for busy/free (program_9 = free).',
      example: 'Add “Wax” mode — operator sees it in post status.',
      regions: {
        toolbar: 'Add mode',
        table: 'Mode list',
        pager: 'Pagination',
      },
    },
    currency: {
      title: 'Currencies',
      summary: 'Currency reference for prices and reports.',
      howItWorks: 'Default currency in Settings. Posts use symbols from this list.',
      example: 'Add USD with $ — post prices display in dollars.',
      regions: {
        toolbar: 'Create currency',
        table: 'List',
        pager: 'Pages',
      },
    },
    discountTypes: {
      title: 'Discount types',
      summary: 'Numbers 1–5 for cards and posts.',
      howItWorks: 'Post sends discount type in NFC session; CRM maps to percentage from reference.',
      example: 'Type 3 = 10% — card with this type gets discount on the post program.',
      regions: {
        toolbar: 'Edit',
        table: 'Types 1–5',
        pager: 'Pagination',
      },
    },
    infoMessages: {
      title: 'Publications',
      summary: 'News and promotions for the information Telegram bot. **Automation → Publications** (`/info-messages`).',
      howItWorks:
        'Published messages shown by bot v2.2; scheduled → “Published” after publishAt. Optional **VK Publisher** sends **text only** to VK — images stay for Telegram. Breadcrumbs: Automation → Publications.',
      example: 'Create “-20% Sunday” promo — bot sends after publishAt.',
      regions: {
        toolbar: 'Create news',
        table: 'Message list',
        pager: 'Pages',
      },
    },
    telegram: {
      title: 'Telegram',
      summary: 'Bots: Management, Service, Information. Start/stop, QR for customers.',
      howItWorks: 'pyorch-bridge runs PyOrchestrator scripts. Private chats only. Demo bots without token on install.',
      example: 'Start Information bot — customers scan QR and see news and post occupancy.',
      regions: {
        bots: 'Bot cards',
        actions: 'Start / Stop / Sync',
        qr: 'Bot QR link',
      },
    },
    mcp: {
      title: 'MCP server',
      summary: 'Connect AI agents (Cursor) to Dynamic API and PyOrchestrator.',
      howItWorks: 'HTTP/SSE endpoints and tokens for MCP clients; copy URL from UI.',
      example: 'Add MCP URL in Cursor — agent queries CRM API on your behalf.',
      regions: {
        language: 'Service status',
        sections: 'URLs and tokens',
        updates: 'Connection guide',
      },
    },
    modules: {
      title: 'Modules',
      summary: 'GitHub extensions: catalog, install, run via PyOrchestrator. **Automation → Modules** (`/modules`).',
      howItWorks:
        'modules-bridge clones repo to `modules/installed/`, registers daemon in PyOrch. **VK Publisher** — text-only to VK (images for CRM/Telegram). Settings UI and **help** — iframe from `ui/index.html` and `ui/help.html`.',
      example: 'Install Post Occupancy Monitor — module polls post-states and shows snapshot on settings page.',
      regions: {
        installed: 'Installed cards',
        available: 'Available from catalog',
        settings: 'Module page (iframe)',
      },
    },
    backups: {
      title: 'Backups',
      summary: 'Scheduled MongoDB dump, manual run, restore.',
      howItWorks: 'Backup service writes to DATA_DIR/backups. RETENTION in .env and Settings.',
      example: 'Before update — “Create backup”, then update CRM from Dashboard.',
      regions: {
        toolbar: 'Create / download',
        table: 'Archive list',
        pager: 'History',
      },
    },
    notifications: {
      title: 'Notifications',
      summary: 'Web alerts: offline posts, errors, collection, updates.',
      howItWorks: 'Event type → i18n template. Telegram if notify bot configured. Live feed on Overview.',
      example: 'Filter “Errors” — critical only today; “Delete all” clears the list.',
      regions: {
        filters: 'Type and status filters',
        list: 'Notification list',
      },
    },
    users: {
      title: 'Users',
      summary: 'Dashboard accounts: login, RBAC group, Telegram user_id.',
      howItWorks: 'JWT via Dynamic API. Groups define permissions (manage_users, update, view).',
      example: 'Create operator in Viewer group — sees status but cannot change settings.',
      regions: {
        users: 'User table',
        groups: 'Link to groups',
      },
    },
    groups: {
      title: 'Groups & permissions',
      summary: 'RBAC: Administrator, Operator, Viewer, Service + custom.',
      howItWorks: 'Permissions in JSON; checked on each API call and in UI (admin-only menu items).',
      example: 'Custom “Accountant” group — Finance and Archive only.',
      regions: {
        users: 'Groups',
        groups: 'Permission matrix',
      },
    },
    settings: {
      title: 'Settings',
      summary: 'Language, MQTT, Telegram notify, integrity, CRM updates, currency.',
      howItWorks:
        'CRM settings in MongoDB. Repair/Updates via update-bridge. Language — localStorage + API. On Mac, if Build fails with Docker Hub timeout — see troubleshooting (docker pull, VPN).',
      example: 'Integrity → Check; Updates → if Hub unreachable, run docker pull node:20-alpine on host, then retry.',
      regions: {
        language: 'Interface language',
        sections: 'MQTT, backup, PyOrch, notifications',
        updates: 'Integrity and software updates',
      },
    },
    setup: {
      title: 'Setup wizard',
      summary: 'First-run and re-run wizard: admin account, MQTT, integrations, demo data.',
      howItWorks:
        'Opens automatically on first login for administrators. Steps persist progress in browser storage; finishing marks setup complete. Can be reopened from the sidebar footer.',
      example: 'After reinstall, admin runs Setup again to verify MQTT credentials and PyOrch connectivity.',
      regions: {
        language: 'Wizard steps',
        sections: 'Account, MQTT, integrations',
        updates: 'Finish and enter CRM',
      },
    },
    welcome: {
      title: 'Welcome screen',
      summary: 'One-time greeting after first login with role hints and quick tips.',
      howItWorks:
        'Shown once per user (stored locally). Explains sidebar navigation and suggests Overview, Posts, and Settings.',
      example: 'New operator sees welcome, reads access level, clicks Enter system.',
      regions: {
        kpi: 'Greeting and role',
        revenue: 'Quick tips list',
        workload: 'Enter system button',
        charts: 'Branding header',
        feed: '—',
      },
    },
    profile: {
      title: 'Profile',
      summary: 'Your account: name, email, password, interface language.',
      howItWorks:
        'Updates Dynamic API user record. Password change requires current password. Language preference syncs with dashboard locale.',
      example: 'Operator changes display name and switches interface to English.',
      regions: {
        users: 'Profile form',
        groups: 'Language selector',
      },
    },
    logs: {
      title: 'Logs',
      summary: 'User and system audit log.',
      howItWorks: 'Dynamic API audit log; filter by user and action.',
      example: 'Find who changed MQTT_PASSWORD — filter action “settings.update”.',
      regions: {
        toolbar: 'Filters',
        table: 'Log entries',
        pager: 'Pagination',
      },
    },
  },
} satisfies HelpMessages;
