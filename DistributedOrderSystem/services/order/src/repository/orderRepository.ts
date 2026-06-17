import { Pool } from 'pg';

export interface OrderItem {
  productId: string;
  quantity: number;
}

export interface SagaStep {
  step: 'ORDER_CREATED' | 'STOCK_RESERVATION' | 'PAYMENT_PROCESSING' | 'SAGA_COMPLETED';
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  message: string;
  timestamp: string;
}

export interface Order {
  id: string;
  userId: string;
  totalAmount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  items: OrderItem[];
  sagaSteps?: SagaStep[];
}

export class OrderRepository {
  constructor(private pool: Pool) {}

  async initializeSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(50) NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0.00
      );

      CREATE TABLE IF NOT EXISTS order_saga_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        step VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL,
        message TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async createOrder(userId: string, items: OrderItem[]): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const totalAmount = 0.00; // In a real system, you'd fetch prices from a product DB
      
      const orderRes = await client.query(
        'INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, $3) RETURNING id',
        [userId, totalAmount, 'PENDING']
      );
      const orderId = orderRes.rows[0].id;

      for (const item of items) {
        await client.query(
          'INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)',
          [orderId, item.productId, item.quantity]
        );
      }

      // Insert initial saga logs
      const initialSagaSteps = [
        { step: 'ORDER_CREATED', status: 'SUCCESS', message: 'Order was placed successfully.' },
        { step: 'STOCK_RESERVATION', status: 'PROCESSING', message: 'Reserving stock from Inventory Service...' },
        { step: 'PAYMENT_PROCESSING', status: 'PENDING', message: 'Waiting for inventory confirmation...' },
        { step: 'SAGA_COMPLETED', status: 'PENDING', message: 'Waiting for all saga steps to complete.' }
      ];

      for (const log of initialSagaSteps) {
        await client.query(
          'INSERT INTO order_saga_logs (order_id, step, status, message) VALUES ($1, $2, $3, $4)',
          [orderId, log.step, log.status, log.message]
        );
      }

      await client.query('COMMIT');
      return orderId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getOrder(id: string): Promise<Order | null> {
    const orderRes = await this.pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) return null;

    const itemsRes = await this.pool.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
    const sagaRes = await this.pool.query(
      'SELECT * FROM order_saga_logs WHERE order_id = $1 ORDER BY timestamp ASC', 
      [id]
    );
    
    // Sort logically to ensure correct display order regardless of timestamp
    const logicOrder = ['ORDER_CREATED', 'STOCK_RESERVATION', 'PAYMENT_PROCESSING', 'SAGA_COMPLETED'];
    const sagaSteps = sagaRes.rows.map((row: any) => ({
      step: row.step,
      status: row.status,
      message: row.message,
      timestamp: row.timestamp.toISOString()
    })).sort((a: any, b: any) => logicOrder.indexOf(a.step) - logicOrder.indexOf(b.step));

    return {
      id: orderRes.rows[0].id,
      userId: orderRes.rows[0].user_id,
      totalAmount: parseFloat(orderRes.rows[0].total_amount),
      status: orderRes.rows[0].status,
      items: itemsRes.rows.map((row: any) => ({
        productId: row.product_id,
        quantity: row.quantity
      })),
      sagaSteps
    };
  }

  async updateSagaStep(orderId: string, step: string, status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED', message: string = ''): Promise<void> {
    await this.pool.query(
      'UPDATE order_saga_logs SET status = $1, message = $2, timestamp = CURRENT_TIMESTAMP WHERE order_id = $3 AND step = $4',
      [status, message, orderId, step]
    );
  }

  async updateOrderStatus(id: string, status: 'PROCESSING' | 'COMPLETED' | 'FAILED'): Promise<void> {
    await this.pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
  }
}
