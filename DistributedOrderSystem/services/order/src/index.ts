import express from 'express';
import cors from 'cors';
import { createPostgresPool, RabbitMQClient } from '@dos/shared';
import { OrderRepository } from './repository/orderRepository';
import { OrderService } from './services/orderService';
import { OrderController } from './controllers/orderController';

async function bootstrap() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Configuration (In production, use dotenv or environment variables)
  const pgUrl = process.env.DATABASE_URL || 'postgres://admin:password@localhost:5432/order_system';
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const mqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

  // Infrastructure
  const pool = createPostgresPool(pgUrl);
  const mq = new RabbitMQClient(mqUrl);
  await mq.connect();

  const repo = new OrderRepository(pool);
  const service = new OrderService(repo, mq, redisUrl);

  // Initialize service dependencies
  await service.initialize();
  await service.listenForUpdates();

  const controller = new OrderController(service);

  // Routes
  app.post('/orders', controller.createOrder);
  app.get('/orders/:id', controller.getOrder);

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Order Service is listening on port ${PORT}`);
  });
}

bootstrap().catch(console.error);
