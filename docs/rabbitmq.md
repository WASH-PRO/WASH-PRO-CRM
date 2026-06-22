---
layout: default
title: RabbitMQ
description: Интеграция контроллеров постов через очередь сообщений
---

## Параметры подключения

| Параметр | Значение |
|----------|----------|
| Exchange | `wash.exchange` (topic, durable) |
| Очередь | `wash.telemetry` |
| Routing key | `telemetry.#` |
| DLQ | `wash.dlq` |
| Пользователь | из `.env` → `RABBITMQ_USER` (по умолчанию `wash`) |

Внутри Docker сеть: `rabbitmq:5672`.  
Снаружи (при `docker-compose.controllers.yml`): `localhost:5672` или порт из `RABBITMQ_EXTERNAL_PORT`.

## Формат сообщения

```json
{
  "washSerial": "WASH-001",
  "postSerial": "POST-001",
  "messageType": "mode",
  "payload": {
    "mode": "wash",
    "modeName": "Мойка",
    "modeNumber": 1,
    "freePause": 30,
    "paidPause": 15,
    "modeTime": 120
  },
  "timestamp": "2024-06-22T12:00:00Z"
}
```

### Поля верхнего уровня

| Поле | Описание |
|------|----------|
| `washSerial` | Серийный номер автомойки (опционально, для логов) |
| `postSerial` | **Обязательно** — серийный номер поста из CRM |
| `messageType` | Тип сообщения (см. ниже) |
| `payload` | Данные, зависящие от типа |
| `timestamp` | ISO 8601 |

### Типы сообщений (`messageType`)

| Тип | Назначение |
|-----|------------|
| `mode` | Текущий режим работы поста |
| `state` | Общее состояние |
| `card` | Операции с картой |
| `statistics` | Статистика использования |
| `finance` | Финансовые данные |
| `equipment` | Состояние оборудования |
| `event` | События и алерты |
| `settings` | Изменение настроек поста |

## Идентификация поста

`message-processor` ищет пост по полю `serialNumber` в `/api/crm/posts`. Убедитесь, что серийный номер в CRM совпадает с `postSerial` в сообщениях контроллера.

## Обработка ошибок

- Успешное сообщение — `ack`
- Ошибка обработки — сообщение в `wash.dlq`, создаётся уведомление при переполнении
- При недоступности RabbitMQ процессор переподключается каждые 5 секунд

## Пример публикации (Node.js)

```javascript
const amqp = require('amqplib');

async function publish() {
  const conn = await amqp.connect('amqp://wash:PASSWORD@localhost:5672');
  const ch = await conn.createChannel();
  await ch.assertExchange('wash.exchange', 'topic', { durable: true });

  const msg = {
    postSerial: 'POST-001',
    messageType: 'mode',
    payload: { mode: 'idle', modeName: 'Ожидание', modeNumber: 0 },
    timestamp: new Date().toISOString(),
  };

  ch.publish('wash.exchange', 'telemetry.mode', Buffer.from(JSON.stringify(msg)), {
    persistent: true,
  });

  await ch.close();
  await conn.close();
}
```

## Включение внешнего доступа

```bash
RABBITMQ_EXTERNAL_PORT=5672 docker compose \
  -f docker-compose.yml \
  -f docker-compose.controllers.yml \
  up -d
```

Ограничьте доступ к порту 5672 файрволом — только IP контроллеров.
