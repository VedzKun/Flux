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
        await this.redisClient.del(`order:${msg.orderId}`); // Invalidate cache
      }
    );

    await this.mq.consume(
      'order_completed_queue',
      'orders_exchange',
      'order.completed',
      async (msg: any) => {
        await this.repo.updateOrderStatus(msg.orderId, 'COMPLETED');
        await this.redisClient.del(`order:${msg.orderId}`);
      }
    );

    await this.mq.consume(
      'order_failed_queue',
      'orders_exchange',
      'order.failed',
      async (msg: any) => {
        await this.repo.updateOrderStatus(msg.orderId, 'FAILED');
        await this.redisClient.del(`order:${msg.orderId}`);
      }
    );
  }
}
