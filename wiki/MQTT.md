# MQTT и управление постами

Полная документация: [docs/mqtt.md](https://wash-pro.github.io/WASH-PRO-CRM/mqtt/)

## Подключение контроллера

- Брокер: `mqtt://wash:PASSWORD@<IP-CRM>:1883`
- Нативный протокол: `{dt_pref}/{serial}/state/{suffix}`
- По умолчанию `dt_pref` = `washpro`
- `serial` = `posts.serialNumber` в CRM (точное совпадение)

## Телеметрия (пост → CRM)

| Suffix | Содержимое |
|--------|------------|
| `process` | balance, pause, mode, card |
| `totals` | финансы до/после инкассации |
| `usages` | счётчики клиентов/услуг |
| `credit` | зачисление с панели |
| `card` | NFC / инкассация |

## Управление (CRM → пост)

### Из Dashboard

**Посты → ⚙** или страница поста → **Настройки устройства**:

- цены режимов 0–9;
- команды (выпадающий список);
- префикс MQTT.

### Топики MQTT

```
{dt_pref}/{serial}/set/prices
{dt_pref}/{serial}/set/command
```

### Команды (`cmd`)

| cmd | Действие |
|-----|----------|
| 1 | Мягкая перезагрузка |
| 2 | Жёсткая перезагрузка |
| 3 | Зачисление (`summ` в рублях) |
| 4 | Режим неисправности |
| 5 | Обслуживание бокса |
| 6 | VIP |
| 7 | Инкассация |

### HTTP API (JWT)

```
POST /api/crm/post-device/posts/{serial}/prices
POST /api/crm/post-device/posts/{serial}/command
```

### mosquitto_pub

```bash
mosquitto_pub -h localhost -p 1883 -u wash -P 'PASS' -q 1 \
  -t 'washpro/SN123/set/prices' -m '{"0":50,"1":80}'

mosquitto_pub -h localhost -p 1883 -u wash -P 'PASS' -q 1 \
  -t 'washpro/SN123/set/command' -m '{"cmd":3,"summ":100}'
```

## Миграция с RabbitMQ

```bash
./scripts/migrate-to-mqtt.sh
```
