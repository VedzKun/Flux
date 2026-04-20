import { Request, Response } from 'express';
import { InventoryService } from '../services/inventoryService';

export class InventoryController {
  constructor(private service: InventoryService) {}

  getInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const inventory = await this.service.getInventory();
      res.json(inventory);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  };
}
