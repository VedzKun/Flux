import { InventoryRepository } from '../repository/inventoryRepository';
import { RabbitMQClient, createRedisClient } from '@dos/shared';

export class InventoryService {
  private redisClient: any;

  constructor(
    private repo: InventoryRepository,
    private mq: RabbitMQClient,
    private redisUrl: string
  ) {}

  async initialize() {
    await this.repo.initializeSchema();
    this.redisClient = await createRedisClient(this.redisUrl);
  }

  async getInventory() {
    // Check cache
    const cached = await this.redisClient.get('inventory:all');
    if (cached) return JSON.parse(cached);

    const inventory = await this.repo.getInventory();
    await this.redisClient.setEx('inventory:all', 30, JSON.stringify(inventory));
    return inventory;
  }

  async listenForOrders() {
    await this.mq.consume(
      'inventory_order_created_queue',
      'orders_exchange',
      'order.created',
      async (msg: any) => {
        let allReserved = true;
        const reservedItems = [];

        for (const item of msg.items) {
          const success = await this.repo.reserveStock(item.productId, item.quantity);
          if (success) {
            reservedItems.push(item);
          } else {
            allReserved = false;
            break;
          }
        }

        if (allReserved) {
          // Process stock reservations to Redis to keep caching aware
          await this.redisClient.del('inventory:all');
          
          await this.mq.publish('inventory_exchange', 'inventory.reserved', {
            orderId: msg.orderId,
            userId: msg.userId,
            items: msg.items // Sending items forward
          });

          await this.mq.publish('orders_exchange', 'order.processing', {
            orderId: msg.orderId
          });
        } else {
          // rollback partial reservations
          for (const item of reservedItems) {
            await this.repo.releaseStock(item.productId, item.quantity);
          }
          await this.mq.publish('inventory_exchange', 'inventory.failed', {
            orderId: msg.orderId,
            reason: 'Insufficient stock'
          });

          await this.mq.publish('orders_exchange', 'order.failed', {
            orderId: msg.orderId,
            reason: 'Insufficient stock'
          });
        }
      }
    );

    // If payment fails, cancel reservation
    await this.mq.consume(
      'inventory_payment_failed_queue',
      'payment_exchange',
      'payment.failed',
      async (msg: any) => {
        for (const item of msg.items) {
          await this.repo.releaseStock(item.productId, item.quantity);
        }
        await this.redisClient.del('inventory:all');
      }
    );

    // If payment succeeds, commit stock
    await this.mq.consume(
      'inventory_payment_successful_queue',
      'payment_exchange',
      'payment.successful',
      async (msg: any) => {
        for (const item of msg.items) {
          await this.repo.commitStock(item.productId, item.quantity);
        }
        await this.redisClient.del('inventory:all');
      }
    );
  }
}
