import { RabbitMQClient } from '@dos/shared';

export class NotificationService {
  constructor(private mq: RabbitMQClient) {}

  async listenForOrderEvents() {
    // Listen for completed orders
    await this.mq.consume(
      'notification_order_completed_queue',
      'orders_exchange',
      'order.completed',
      async (msg: any) => {
        const userId = msg.userId || 'user123'; // Mock user
        const email = `${userId}@example.com`;
        console.log(`[Notification] Sending ORDER COMPLETED email to ${email} for order ${msg.orderId}`);
      }
    );

    // Listen for failed orders
    await this.mq.consume(
      'notification_order_failed_queue',
      'orders_exchange',
      'order.failed',
      async (msg: any) => {
        const userId = msg.userId || 'user123'; // Mock user
        const email = `${userId}@example.com`;
        console.log(`[Notification] Sending ORDER FAILED email to ${email} for order ${msg.orderId}. Reason: ${msg.reason}`);
      }
    );
  }
}
