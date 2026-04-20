import { createPostgresPool, RabbitMQClient } from '@dos/shared';
import { PaymentRepository } from './repository/paymentRepository';
import { PaymentService } from './services/paymentService';

async function bootstrap() {
  const pgUrl = process.env.DATABASE_URL || 'postgres://admin:password@localhost:5432/order_system';
  const mqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

  const pool = createPostgresPool(pgUrl);
  const mq = new RabbitMQClient(mqUrl);
  await mq.connect();

  const repo = new PaymentRepository(pool);
  const service = new PaymentService(repo, mq);

  await service.initialize();
  await service.listenForReservations();

  console.log('Payment Service is running and listening for reservations...');
}

bootstrap().catch(console.error);
