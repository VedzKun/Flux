import { Pool } from 'pg';

export class PaymentRepository {
  constructor(private pool: Pool) {}

  async initializeSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) NOT NULL,
        retry_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async recordTransaction(orderId: string, amount: number, status: 'SUCCESS' | 'FAILED') {
    await this.pool.query(
      'INSERT INTO transactions (order_id, amount, status) VALUES ($1, $2, $3)',
      [orderId, amount, status]
    );
  }
}
