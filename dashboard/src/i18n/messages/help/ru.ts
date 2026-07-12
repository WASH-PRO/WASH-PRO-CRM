import type { HelpMessages } from './types';

export const helpRu = {
  title: 'Справка WASH PRO CRM',
  close: 'Закрыть справку',
  open: 'Справка',
  searchPlaceholder: 'Поиск раздела…',
  howItWorks: 'Как работает',
  example: 'Пример',
  onScreen: 'На экране',
  adminBadge: 'Администратор',
  docsLink: 'Полная документация на GitHub Pages',
  docsModulesLink: 'Документация по модулям',
  moduleHelpIntro: 'Справка поставляется автором модуля (`ui/help.html` / `ui/help.ru.html` в репозитории).',
  sections: {
    navigation: {
      title: 'Навигация и справка',
      summary:
        'Внизу sidebar: **Мастер настроек** → **Справка** → **Ресурсы** (Документация, GitHub). Хлебные крошки над страницей.',
      howItWorks:
        'Меню: **Главное** (Обзор, Состояние), **Объекты**, **Данные**, **Карты**, **Аналитика**, **Справочники**, **Автоматизация** (Публикации, Telegram, MCP, Бэкапы), **Система** (Информация о сервере, Уведомления, Пользователи, Настройки…). Хлебные крошки повторяют группу и раздел — например «Аналитика → Использование» или «Система → Информация»; группа не кликабельна, родительские разделы — ссылки. Справка открывается кнопкой в шапке: полноэкранное окно, поиск, схемы экранов; закрытие — ✕ или Esc.',
      example:
        'На «Публикации» крошки: Автоматизация → Публикации. Нужна подсказка по боту — открываете справку и переходите в раздел Telegram.',
      regions: {
        kpi: 'Sidebar внизу: Справка над Документацией',
        revenue: 'Хлебные крошки (группа → раздел)',
        workload: 'Боковое меню по группам',
        charts: 'Контент текущей страницы',
        feed: 'Resources: Dynamic API, PyOrchestrator',
      },
    },
    dashboard: {
      title: 'Обзор',
      summary:
        'Главная панель KPI: выручка, загрузка постов, последние уведомления. Данные обновляются в режиме Live (переключатель в шапке).',
      howItWorks:
        'Dynamic API агрегирует телеметрию с постов через MQTT и MongoDB. Карточки показывают текущий период; графики — динамику по дням; справа — лента событий.',
      example:
        'Утром оператор открывает Обзор: видит выручку за вчера, пик загрузки в 18:00 и уведомление «Пост 3 offline» — переходит в Состояние.',
      regions: {
        kpi: 'KPI-карточки (выручка, сессии)',
        revenue: 'График выручки по дням',
        workload: 'График загруженности',
        charts: 'Круговые диаграммы использования и оплаты',
        feed: 'Лента последних уведомлений',
      },
    },
    states: {
      title: 'Состояние',
      summary: 'Все посты сети: онлайн/оффлайн, режим, таймер сессии, интерактивный график активности.',
      howItWorks:
        'Статус приходит из MQTT-телеметрии (`state/post`). Страница опрашивает API каждые несколько секунд в Live-режиме. Клик по посту открывает детальную карточку.',
      example: 'Диспетчер видит пост «offline» красным — звонит на объект или открывает детали поста для диагностики.',
      regions: {
        grid: 'Сетка постов со статусами',
        chart: 'График активности по времени',
      },
    },
    system: {
      title: 'Информация',
      summary:
        'Ресурсы сервера (CPU, память, диск), версия CRM и встроенных компонентов. Раздел в группе **Система** (`/system`).',
      howItWorks:
        'Dynamic API читает `/proc`, Docker и `update-bridge` для версий. Обновление метрик каждые 30 с. В хлебных крошках: Система → Информация.',
      example: 'Администратор проверяет, что CRM v1.1.22 и место на диске DATA_DIR достаточно для бэкапов.',
      regions: {
        app: 'Блок приложения WASH PRO CRM',
        components: 'Версии Dynamic API, PyOrchestrator',
        metrics: 'Метрики хоста и сеть',
      },
    },
    washes: {
      title: 'Автомойки',
      summary: 'Справочник объектов (филиалов): название, адрес, привязка постов.',
      howItWorks: 'CRUD через Dynamic API → MongoDB. Посты ссылаются на мойку. Удаление возможно, если нет активных постов.',
      example: 'Добавляете «Мойка на Ленина» — затем создаёте посты с serial для контроллеров на этой площадке.',
      regions: {
        toolbar: 'Кнопки: создать, обновить, поиск',
        table: 'Таблица автомоек',
        pager: 'Пагинация',
      },
    },
    posts: {
      title: 'Посты',
      summary: 'Мойка-боксы с serial, MQTT-учёткой, ценами и настройками устройства.',
      howItWorks:
        'Каждый пост — уникальный serial в MQTT. При сохранении message-processor синхронизирует passwd/ACL Mosquitto.',
      example: 'Новый пост: serial `WP-001`, логин `post001`, привязка к мойке — контроллер подключается к брокеру.',
      regions: {
        toolbar: 'Создание и фильтры',
        table: 'Список постов',
        pager: 'Страницы таблицы',
      },
    },
    postDetail: {
      title: 'Детали поста',
      summary: 'Управление постом: команды, цены, журнал, телеметрия в реальном времени.',
      howItWorks:
        'Команды уходят в MQTT (`set/*`). Цены — через message-processor. Журнал — события NFC и сессий.',
      example: 'Оператор отправляет «Stop program» и меняет цену «Мойка стандарт» — устройство получает через MQTT.',
      regions: {
        status: 'Онлайн, режим, таймер',
        commands: 'Кнопки команд',
        prices: 'Таблица цен',
        journal: 'Журнал событий',
      },
    },
    mqtt: {
      title: 'MQTT',
      summary: 'Учётные записи постов и CRM, пароль system, синхронизация ACL.',
      howItWorks:
        'Пароль CRM (`system`) задаётся в Настройках. Посты — отдельные логины. Кнопка sync пересоздаёт passwd/acl в DATA_DIR.',
      example: 'После смены MQTT_PASSWORD в Настройках — сохранить и дождаться sync; посты переподключаются с новым паролем CRM.',
      regions: {
        accounts: 'Учётные записи постов',
        crm: 'Учётная запись CRM (system)',
        sync: 'Синхронизация passwd/ACL',
      },
    },
    cardsDiscount: {
      title: 'Скидочные карты',
      summary: 'Клиентские карты с балансом и типом скидки 1–5.',
      howItWorks: 'NFC-события с поста создают строки в журнале применений. Тип карты `regular`.',
      example: 'Клиент приложил карту — в журнале «success», баланс уменьшился на стоимость программы.',
      regions: {
        tabs: 'Вкладки типов карт',
        list: 'Список карт',
        log: 'Журнал применений NFC',
      },
    },
    cardsService: {
      title: 'Сервисные карты',
      summary: 'Служебные карты для персонала (`service`).',
      howItWorks: 'Аналогично скидочным, но без клиентского биллинга; используются для техобслуживания.',
      example: 'Техник открывает бокс сервисной картой — событие фиксируется отдельно от клиентских.',
      regions: {
        tabs: 'Тип карты',
        list: 'Список карт',
        log: 'Журнал',
      },
    },
    cardsVip: {
      title: 'VIP карты',
      summary: 'Безлимитные карты (`unlimited`).',
      howItWorks: 'Списание баланса может не применяться — зависит от настроек типа скидки на посту.',
      example: 'VIP-клиент проходит без очереди — в журнале отображается применение карты.',
      regions: {
        tabs: 'VIP',
        list: 'Карты',
        log: 'Журнал',
      },
    },
    cardsCollection: {
      title: 'Инкассация',
      summary: 'События инкассации наличных с постов.',
      howItWorks: 'Устройство отправляет cardType `collection` — CRM создаёт уведомление, не строку в картах.',
      example: 'После инкассации аналитика «до/после» в Использовании и Финансах разделяет периоды.',
      regions: {
        tabs: 'Инкассация',
        list: 'События',
        log: 'Детали',
      },
    },
    usage: {
      title: 'Использование',
      summary: 'Статистика времени работы постов до и после инкассации.',
      howItWorks: 'Агрегация `usage-stats` по категориям regular/service/unlimited.',
      example: 'Сравниваете загрузку до и после инкассации за неделю — видите реальный трафик клиентов.',
      regions: {
        filters: 'Период и мойка',
        chart: 'График использования',
        table: 'Таблица по постам',
      },
    },
    finance: {
      title: 'Финансы',
      summary: 'Выручка: наличные, безнал, скидочные, итого.',
      howItWorks: 'Данные из `finance-stats`, привязка к постам и периодам инкассации.',
      example: 'Отчёт за месяц: 60% безнал, 40% наличные — экспорт для бухгалтерии.',
      regions: {
        filters: 'Фильтры периода',
        chart: 'Диаграммы выручки',
        table: 'Детализация',
      },
    },
    archive: {
      title: 'Архив',
      summary: 'Политики архивирования и журнал операций.',
      howItWorks: 'Настраиваемые правила по группам данных; старые записи переносятся или удаляются по расписанию.',
      example: 'Архивируете телеметрию старше 90 дней — MongoDB освобождает место.',
      regions: {
        filters: 'Политики',
        chart: 'Статистика архива',
        table: 'Журнал операций',
      },
    },
    workModes: {
      title: 'Режимы работы',
      summary: 'Справочник программ/режимов постов (program_1 … program_9).',
      howItWorks: 'Используются в телеметрии и Telegram-боте для «занят/свободен» (program_9 = свободен).',
      example: 'Добавляете режим «Воск» с кодом — оператор видит его в состоянии поста.',
      regions: {
        toolbar: 'Добавить режим',
        table: 'Список режимов',
        pager: 'Пагинация',
      },
    },
    currency: {
      title: 'Валюты',
      summary: 'Справочник валют для цен и отчётов.',
      howItWorks: 'Валюта по умолчанию — в Настройках. Посты могут использовать символ из справочника.',
      example: 'Добавляете KZT с символом ₸ — цены на постах отображаются в тенге.',
      regions: {
        toolbar: 'Создать валюту',
        table: 'Список',
        pager: 'Страницы',
      },
    },
    discountTypes: {
      title: 'Типы скидок',
      summary: 'Номера 1–5 для карт и постов.',
      howItWorks: 'Пост передаёт тип скидки в NFC-сессии; CRM сопоставляет с процентом из справочника.',
      example: 'Тип 3 = 10% — карта с этим типом получает скидку на программе поста.',
      regions: {
        toolbar: 'Редактирование',
        table: 'Типы 1–5',
        pager: 'Пагинация',
      },
    },
    infoMessages: {
      title: 'Публикации',
      summary: 'Новости и акции для информационного Telegram-бота. Раздел **Автоматизация → Публикации** (`/info-messages`).',
      howItWorks:
        'Published messages are shown by bot v2.2; scheduled → Published when time passes. **VK Publisher** module (optional) sends **text only** to VK — images stay for Telegram. Breadcrumbs: Automation → Publications.',
      example: 'Создаёте акцию «-20% в воскресенье» — бот рассылает после publishAt.',
      regions: {
        toolbar: 'Создать новость',
        table: 'Список сообщений',
        pager: 'Страницы',
      },
    },
    telegram: {
      title: 'Telegram',
      summary: 'Боты: Управление, Сервисный, Информационный. Запуск/остановка, QR для клиентов.',
      howItWorks: 'pyorch-bridge управляет скриптами PyOrchestrator. Только личные чаты. Демо-боты без токена при установке.',
      example: 'Запускаете Information bot — клиенты сканируют QR и видят новости и занятость постов.',
      regions: {
        bots: 'Карточки ботов',
        actions: 'Start / Stop / Sync',
        qr: 'QR-ссылка на бота',
      },
    },
    mcp: {
      title: 'MCP сервер',
      summary: 'Подключение AI-агентов (Cursor) к Dynamic API и PyOrchestrator.',
      howItWorks: 'HTTP/SSE endpoints и токены для MCP-клиентов; копирование URL из UI.',
      example: 'В Cursor добавляете MCP URL — агент запрашивает CRM API от вашего имени.',
      regions: {
        language: 'Статус сервисов',
        sections: 'URL и токены',
        updates: 'Инструкция подключения',
      },
    },
    modules: {
      title: 'Модули',
      summary: 'Расширения из GitHub: каталог, установка, запуск через PyOrchestrator. **Автоматизация → Модули** (`/modules`).',
      howItWorks:
        'modules-bridge клонирует репозиторий в `modules/installed/`, регистрирует daemon в PyOrch. **VK публикатор** — во VK только текст (картинки для CRM/Telegram). UI настроек и **справка** — iframe из `ui/index.html` и `ui/help.html`.',
      example: 'Устанавливаете «Монитор занятости» — модуль опрашивает post-states и показывает снимок на странице настроек.',
      regions: {
        installed: 'Установленные карточки',
        available: 'Доступные из каталога',
        settings: 'Страница модуля (iframe)',
      },
    },
    backups: {
      title: 'Резервные копии',
      summary: 'MongoDB dump по расписанию, ручной запуск, восстановление.',
      howItWorks: 'Сервис backup пишет в DATA_DIR/backups. RETENTION в .env и Настройках.',
      example: 'Перед обновлением — «Создать бэкап», затем обновление CRM из Dashboard.',
      regions: {
        toolbar: 'Создать / скачать',
        table: 'Список архивов',
        pager: 'История',
      },
    },
    notifications: {
      title: 'Уведомления',
      summary: 'Web-уведомления: offline постов, ошибки, инкассация, обновления.',
      howItWorks: 'Тип события → шаблон i18n. Telegram — если настроен notify bot. Live-обновление на Обзоре.',
      example: 'Фильтр «Ошибки» — только critical за сегодня; «Удалить все» очищает список.',
      regions: {
        filters: 'Фильтры типа и статуса',
        list: 'Список уведомлений',
      },
    },
    users: {
      title: 'Пользователи',
      summary: 'Учётные записи Dashboard: логин, группа RBAC, Telegram user_id.',
      howItWorks: 'JWT через Dynamic API. Группы задают permissions (manage_users, update, view).',
      example: 'Создаёте оператора в группе Viewer — видит состояние, но не меняет настройки.',
      regions: {
        users: 'Таблица пользователей',
        groups: 'Ссылка на группы',
      },
    },
    groups: {
      title: 'Группы и права',
      summary: 'RBAC: Administrator, Operator, Viewer, Service + custom.',
      howItWorks: 'Permissions в JSON; проверка на каждом API и в UI (admin-only пункты меню).',
      example: 'Custom-группа «Бухгалтер» — доступ только к Финансам и Архиву.',
      regions: {
        users: 'Группы',
        groups: 'Матрица прав',
      },
    },
    settings: {
      title: 'Настройки',
      summary: 'Язык, MQTT, Telegram notify, целостность, обновления CRM, валюта.',
      howItWorks:
        'CRM settings в MongoDB. Repair/Updates — через update-bridge. Язык — localStorage + API. На Mac при падении на шаге «Сборка» с таймаутом Docker Hub — см. раздел устранения неполадок (docker pull, VPN).',
      example: 'Целостность → Проверить; Обновления → если Hub недоступен — docker pull node:20-alpine на хосте, затем повтор.',
      regions: {
        language: 'Язык интерфейса',
        sections: 'MQTT, бэкап, PyOrch, уведомления',
        updates: 'Целостность и обновления ПО',
      },
    },
    logs: {
      title: 'Логи',
      summary: 'Журнал действий пользователей и системы (audit).',
      howItWorks: 'Dynamic API audit log; фильтр по пользователю и действию.',
      example: 'Ищете кто менял MQTT_PASSWORD — фильтр по action «settings.update».',
      regions: {
        toolbar: 'Фильтры',
        table: 'Записи лога',
        pager: 'Пагинация',
      },
    },
  },
} satisfies HelpMessages;
