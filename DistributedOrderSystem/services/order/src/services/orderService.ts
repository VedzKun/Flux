import { OrderRepository, OrderItem } from '../repository/orderRepository';
import { RabbitMQClient, createRedisClient } from '@dos/shared';

export class OrderService {
  private redisClient: any;

  constructor(
    private repo: OrderRepository,
    private mq: RabbitMQClient,
    private redisUrl: string
  ) {}

  async initialize() {
    await this.repo.initializeSchema();
    this.redisClient = await createRedisClient(this.redisUrl);
  }

  async createOrder(userId: string, items: OrderItem[]): Promise<string> {
    const orderId = await this.repo.createOrder(userId, items);
    
    const event = {
      orderId,
      userId,
      items,
      timestamp: new Date().toISOString()
    };

    // Publish event
    await this.mq.publish('orders_exchange', 'order.created', event);
    return orderId;
  }

  async getOrder(orderId: string) {
    // Try cache first
    const cached = await this.redisClient.get(`order:${orderId}`);
    if (cached) return JSON.parse(cached);

    // Fallback to DB
    const order = await this.repo.getOrder(orderId);
    if (order) {
      // Cache for 60 seconds
      await this.redisClient.setEx(`order:${orderId}`, 60, JSON.stringify(order));
    }
    return order;
  }

  async listenForUpdates() {
    await this.mq.consume(
      'order_updates_queue',
      'orders_exchange',
      'order.processing',
      async (msg: any) => {
        await this.repo.updateOrderStatus(msg.orderId, 'PROCESSING');
        await this.repo.updateSagaStep(msg.orderId, 'STOCK_RESERVATION', 'SUCCESS', 'Inventory stock reserved successfully.');
        await this.repo.updateSagaStep(msg.orderId, 'PAYMENT_PROCESSING', 'PROCESSING', 'Executing payment transaction...');
        await this.redisClient.del(`order:${msg.orderId}`); // Invalidate cache
      }
    );

    await this.mq.consume(
      'order_completed_queue',
      'orders_exchange',
      'order.completed',
      async (msg: any) => {
        await this.repo.updateOrderStatus(msg.orderId, 'COMPLETED');
        await this.repo.updateSagaStep(msg.orderId, 'PAYMENT_PROCESSING', 'SUCCESS', 'Payment processed successfully.');
        await this.repo.updateSagaStep(msg.orderId, 'SAGA_COMPLETED', 'SUCCESS', 'Saga flow completed. Order fulfilled.');
        await this.redisClient.del(`order:${msg.orderId}`);
      }
    );

    await this.mq.consume(
      'order_failed_queue',
      'orders_exchange',
      'order.failed',
      async (msg: any) => {
        await this.repo.updateOrderStatus(msg.orderId, 'FAILED');
        
        if (msg.reason === 'Insufficient stock') {
          await this.repo.updateSagaStep(msg.orderId, 'STOCK_RESERVATION', 'FAILED', 'Failed: Insufficient stock.');
          await this.repo.updateSagaStep(msg.orderId, 'PAYMENT_PROCESSING', 'FAILED', 'Payment cancelled due to reservation failure.');
          await this.repo.updateSagaStep(msg.orderId, 'SAGA_COMPLETED', 'FAILED', 'Order failed: Insufficient stock.');
        } else if (msg.reason === 'Card declined randomly') {
          await this.repo.updateSagaStep(msg.orderId, 'STOCK_RESERVATION', 'FAILED', 'Compensating action: stock reservation rolled back.');
          await this.repo.updateSagaStep(msg.orderId, 'PAYMENT_PROCESSING', 'FAILED', 'Payment failed: Card declined randomly.');
          await this.repo.updateSagaStep(msg.orderId, 'SAGA_COMPLETED', 'FAILED', 'Order failed: Payment declined.');
        } else {
          await this.repo.updateSagaStep(msg.orderId, 'SAGA_COMPLETED', 'FAILED', `Order failed: ${msg.reason}`);
        }

        await this.redisClient.del(`order:${msg.orderId}`);
      }
    );
  }
}
