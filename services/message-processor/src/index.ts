import amqp from 'amqplib';
import { processMessage, WashMessage } from './processor.js';
import { logger } from './api-client.js';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://wash:wash_secret@rabbitmq:5672';
const QUEUE = process.env.RABBITMQ_QUEUE || 'wash.telemetry';
const DLQ = 'wash.dlq';

async function connect(): Promise<void> {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.assertExchange('wash.exchange', 'topic', { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.assertQueue(DLQ, { durable: true });
  await channel.bindQueue(QUEUE, 'wash.exchange', 'telemetry.#');
  await channel.prefetch(10);

  logger.info({ queue: QUEUE }, 'Connected to RabbitMQ');

  await channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const content = JSON.parse(msg.content.toString()) as WashMessage;
      await processMessage(content);
      channel.ack(msg);
    } catch (err) {
      logger.error({ err }, 'Failed to process message');
      channel.sendToQueue(DLQ, msg.content, { persistent: true });
      channel.ack(msg);

      if (String(err).includes('queue') || String(err).includes('overflow')) {
        try {
          const { createNotification } = await import('./api-client.js');
          await createNotification({
            type: 'queue_overflow',
            severity: 'error',
            message: 'Переполнение очереди сообщений',
          });
        } catch {
          // best effort
        }
      }
    }
  });

  process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    await channel.close();
    await connection.close();
    process.exit(0);
  });
}

async function main(): Promise<void> {
  logger.info('Message Processor starting...');

  while (true) {
    try {
      await connect();
      break;
    } catch (err) {
      logger.error({ err }, 'RabbitMQ connection failed, retrying in 5s');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error');
  process.exit(1);
});
