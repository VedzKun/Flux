import { RabbitMQClient } from '@dos/shared';
import { NotificationService } from './services/notificationService';

async function bootstrap() {
  const mqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

  const mq = new RabbitMQClient(mqUrl);
  await mq.connect();

  const service = new NotificationService(mq);
  await service.listenForOrderEvents();

  console.log('Notification Service is running and listening for order events...');
}

bootstrap().catch(console.error);
