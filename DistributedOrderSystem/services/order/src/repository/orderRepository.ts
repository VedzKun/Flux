import { Pool } from 'pg';

export interface OrderItem {
  productId: string;
  quantity: number;
}

export interface Order {
  id: string;
  userId: string;
  totalAmount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  items: OrderItem[];
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
    
    return {
      id: orderRes.rows[0].id,
      userId: orderRes.rows[0].user_id,
      totalAmount: parseFloat(orderRes.rows[0].total_amount),
      status: orderRes.rows[0].status,
      items: itemsRes.rows.map((row: any) => ({
        productId: row.product_id,
        quantity: row.quantity
      }))
    };
  }

  async updateOrderStatus(id: string, status: 'PROCESSING' | 'COMPLETED' | 'FAILED'): Promise<void> {
    await this.pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
  }
}
