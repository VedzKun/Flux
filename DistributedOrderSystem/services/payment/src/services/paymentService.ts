import { PaymentRepository } from '../repository/paymentRepository';
import { RabbitMQClient } from '@dos/shared';

export class PaymentService {
  constructor(
    private repo: PaymentRepository,
    private mq: RabbitMQClient
  ) {}

  async initialize() {
    await this.repo.initializeSchema();
  }

  async listenForReservations() {
    await this.mq.consume(
      'payment_inventory_reserved_queue',
      'inventory_exchange',
      'inventory.reserved',
      async (msg) => {
        // Calculate mock amount
        const amount = 100.00; // Mock calculation based on items
        
        // Mock success/failure randomly (80% success rate)
        const isSuccess = Math.random() < 0.8;

        if (isSuccess) {
          await this.repo.recordTransaction(msg.orderId, amount, 'SUCCESS');
          await this.mq.publish('payment_exchange', 'payment.successful', {
            orderId: msg.orderId,
            items: msg.items
          });
        } else {
          await this.repo.recordTransaction(msg.orderId, amount, 'FAILED');
          await this.mq.publish('payment_exchange', 'payment.failed', {
            orderId: msg.orderId,
            items: msg.items,
            reason: 'Card declined randomly'
          });
        }
      }
    );
  }
}
