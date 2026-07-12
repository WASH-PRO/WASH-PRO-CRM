# Dashboard i18n structure

Locale catalogs live under `dashboard/src/i18n/messages/`.

## Layout

| Path | Purpose |
|------|---------|
| `ru.ts` / `en.ts` | **Core catalog** — compose feature modules into the full message tree |
| `help/ru.ts`, `help/en.ts` | In-app help sections (modal + module help) |
| `features/modules.*.ts` | Modules page strings |
| `features/updates.*.ts` | Software updates, update banner, integrity & repair |
| `features/notifications-features.*.ts` | Notification groups/events for modules & updates |

## Adding strings

- **Core CRM UI** (nav, pages, tables): add to `ru.ts` / `en.ts` directly.
- **Modules feature**: edit `features/modules.ru.ts` and `features/modules.en.ts`.
- **Updates / repair**: edit `features/updates.ru.ts` and `features/updates.en.ts`.
- **Help content**: edit `help/ru.ts` and `help/en.ts`.

Keep RU and EN files in sync (same keys).

## Usage in code

```typescript
const { t } = useLocale();
t('pages.modules.title');
t('updates.checkNow');
t('pages.settings.repair.check');
```

Runtime helpers: `dashboard/src/i18n/runtime.ts`, `translate.ts`.
