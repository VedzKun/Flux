import { Pool } from 'pg';

export interface InventoryItem {
  productId: string;
  sku: string;
  stockAvailable: number;
  stockReserved: number;
}

export class InventoryRepository {
  constructor(private pool: Pool) {}

  async initializeSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sku VARCHAR(50) UNIQUE NOT NULL,
        stock_available INT NOT NULL DEFAULT 0,
        stock_reserved INT NOT NULL DEFAULT 0
      );
    `);

    // Seed dummy data if needed
    const count = await this.pool.query('SELECT COUNT(*) FROM inventory');
    if (parseInt(count.rows[0].count) === 0) {
      await this.pool.query(`
        INSERT INTO inventory (product_id, sku, stock_available, stock_reserved)
        VALUES ('11111111-1111-1111-1111-111111111111', 'ITEM-1', 100, 0),
               ('22222222-2222-2222-2222-222222222222', 'ITEM-2', 50, 0);
      `);
    }
  }

  async getInventory(): Promise<InventoryItem[]> {
    const res = await this.pool.query('SELECT * FROM inventory');
    return res.rows.map((row: any) => ({
      productId: row.product_id,
      sku: row.sku,
      stockAvailable: row.stock_available,
      stockReserved: row.stock_reserved
    }));
  }

  async reserveStock(productId: string, quantity: number): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query('SELECT stock_available FROM inventory WHERE product_id = $1 FOR UPDATE', [productId]);
      if (res.rows.length === 0 || res.rows[0].stock_available < quantity) {
        await client.query('ROLLBACK');
        return false; // Insufficient stock
      }

      await client.query(
        'UPDATE inventory SET stock_available = stock_available - $1, stock_reserved = stock_reserved + $1 WHERE product_id = $2',
        [quantity, productId]
      );
      
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async releaseStock(productId: string, quantity: number): Promise<void> {
    await this.pool.query(
      'UPDATE inventory SET stock_available = stock_available + $1, stock_reserved = stock_reserved - $1 WHERE product_id = $2',
      [quantity, productId]
    );
  }

  async commitStock(productId: string, quantity: number): Promise<void> {
    await this.pool.query(
      'UPDATE inventory SET stock_reserved = stock_reserved - $1 WHERE product_id = $2',
      [quantity, productId]
    );
  }
}
