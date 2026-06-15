import express from 'express';
import cors from 'cors';
import { createPostgresPool, RabbitMQClient } from '@dos/shared';
import { InventoryRepository } from './repository/inventoryRepository';
import { InventoryService } from './services/inventoryService';
import { InventoryController } from './controllers/inventoryController';

async function bootstrap() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const pgUrl = process.env.DATABASE_URL || 'postgres://admin:password@localhost:5432/order_system';
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const mqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

  const pool = createPostgresPool(pgUrl);
  const mq = new RabbitMQClient(mqUrl);
  await mq.connect();

  const repo = new InventoryRepository(pool);
  const service = new InventoryService(repo, mq, redisUrl);

  await service.initialize();
  await service.listenForOrders();

  const controller = new InventoryController(service);

  app.get('/inventory', controller.getInventory);

  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => {
    console.log(`Inventory Service is listening on port ${PORT}`);
  });
}

bootstrap().catch(console.error);
