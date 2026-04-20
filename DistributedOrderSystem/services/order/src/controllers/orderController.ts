import { Request, Response } from 'express';
import { OrderService } from '../services/orderService';

export class OrderController {
  constructor(private service: OrderService) {}

  createOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, items } = req.body;
      if (!userId || !items || !Array.isArray(items)) {
        res.status(400).json({ error: 'Invalid request body' });
        return;
      }
      const orderId = await this.service.createOrder(userId, items);
      res.status(201).json({ orderId, status: 'PENDING' });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  };

  getOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const order = await this.service.getOrder(id);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      res.json(order);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  };
}
