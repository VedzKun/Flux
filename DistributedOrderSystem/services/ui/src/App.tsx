import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Activity, ShoppingCart, PlusCircle, Server, CheckCircle2, CircleDashed, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import './index.css';

const ORDER_API = 'http://localhost:3001';
const INVENTORY_API = 'http://localhost:3002';

interface InventoryItem {
  productId: string;
  sku: string;
  stockAvailable: number;
  stockReserved: number;
}

interface SagaStep {
  step: 'ORDER_CREATED' | 'STOCK_RESERVATION' | 'PAYMENT_PROCESSING' | 'SAGA_COMPLETED';
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  message: string;
  timestamp: string;
}

interface Order {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalAmount: number;
  items: { productId: string; quantity: number }[];
  sagaSteps?: SagaStep[];
}

function App() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  
  // Form state
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Poll inventory
  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const res = await axios.get(`${INVENTORY_API}/inventory`);
        setInventory(res.data);
        if (res.data.length > 0 && productId === '') {
          setProductId(res.data[0].productId);
        }
      } catch (err) {
        console.error('Failed to fetch inventory:', err);
      }
    };
    
    fetchInventory();
    const interval = setInterval(fetchInventory, 2000);
    return () => clearInterval(interval);
  }, [productId]);

  // Poll orders
  useEffect(() => {
    const fetchOrderStatuses = async () => {
      if (orders.length === 0) return;
      
      const updatedOrders = await Promise.all(
        orders.map(async (order) => {
          if (order.status === 'completed' || order.status === 'failed') return order;
          try {
            const res = await axios.get(`${ORDER_API}/orders/${order.id}`);
            return res.data;
          } catch (err) {
            return order;
          }
        })
      );
      
      // Update state only if status changed to avoid unnecessary re-renders
      setOrders(current => {
        let changed = false;
        const next = current.map(o => {
          const up = updatedOrders.find(u => u.id === o.id);
          if (up && up.status !== o.status) {
            changed = true;
            return up;
          }
          return o;
        });
        return changed ? next : current;
      });
    };

    const interval = setInterval(fetchOrderStatuses, 2000);
    return () => clearInterval(interval);
  }, [orders]);

  const toggleExpanded = (id: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await axios.post(`${ORDER_API}/orders`, {
        userId: `user_${Math.floor(Math.random() * 1000)}`,
        items: [{ productId, quantity }]
      });
      const newOrder: Order = {
        id: res.data.orderId,
        status: 'pending',
        totalAmount: 0, // This gets updated on next poll
        items: [{ productId, quantity }],
        sagaSteps: [
          { step: 'ORDER_CREATED', status: 'SUCCESS', message: 'Order was placed successfully.', timestamp: new Date().toISOString() },
          { step: 'STOCK_RESERVATION', status: 'PROCESSING', message: 'Reserving stock from Inventory Service...', timestamp: new Date().toISOString() },
          { step: 'PAYMENT_PROCESSING', status: 'PENDING', message: 'Waiting for inventory confirmation...', timestamp: new Date().toISOString() },
          { step: 'SAGA_COMPLETED', status: 'PENDING', message: 'Waiting for all saga steps to complete.', timestamp: new Date().toISOString() }
        ]
      };
      setOrders(prev => [newOrder, ...prev]);
    } catch (err) {
      console.error('Failed to create order:', err);
      alert('Failed to create order. See console.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <Activity className="brand-icon" size={28} />
          Distributed
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            <Server size={18} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>SYSTEM STATUS</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
            <div className="live-indicator"></div>
            <span style={{ fontSize: '0.875rem' }}>Order Service: Live</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
            <div className="live-indicator"></div>
            <span style={{ fontSize: '0.875rem' }}>Inventory Service: Live</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header">
          <h1>System Overview</h1>
          <div style={{ color: 'var(--text-secondary)' }}>
            Visualizing Choreography Saga Pattern
          </div>
        </header>

        <div className="grid-layout">
          {/* Inventory Panel */}
          <section className="panel">
            <h2 className="panel-header">
              <Package size={20} />
              Live Inventory
            </h2>
            <div className="inventory-grid">
              {inventory.map(item => (
                <div key={item.productId} className="inventory-card">
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{item.sku}</div>
                  <div className="stock-value">{item.stockAvailable}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>in stock</div>
                </div>
              ))}
              {inventory.length === 0 && (
                <div style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1', textAlign: 'center', padding: '20px' }}>
                  Connecting to inventory service...
                </div>
              )}
            </div>
          </section>

          {/* Create Order Panel */}
          <section className="panel">
            <h2 className="panel-header">
              <ShoppingCart size={20} />
              Create Order
            </h2>
            <form onSubmit={handleCreateOrder}>
              <div className="form-group">
                <label>Select Product</label>
                <select 
                  className="form-control" 
                  value={productId} 
                  onChange={e => setProductId(e.target.value)}
                >
                  {inventory.length > 0 ? (
                    inventory.map(item => (
                      <option key={item.productId} value={item.productId}>
                        {item.sku} (Available: {item.stockAvailable})
                      </option>
                    ))
                  ) : (
                    <option value="">Loading...</option>
                  )}
                  <option value="11111111-0000-0000-0000-000000000000">INVALID-SKU (Simulate Failure)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Quantity</label>
                <input 
                  type="number" 
                  min="1" 
                  className="form-control" 
                  value={quantity} 
                  onChange={e => setQuantity(parseInt(e.target.value))}
                />
              </div>
              <button type="submit" className="btn" disabled={isSubmitting}>
                <PlusCircle size={18} />
                {isSubmitting ? 'Processing...' : 'Place Order'}
              </button>
            </form>
          </section>

          {/* Recent Orders Panel */}
          <section className="panel" style={{ gridColumn: '1 / -1' }}>
            <h2 className="panel-header">
              <Activity size={20} />
              Recent Orders Saga
            </h2>
            <ul className="list">
              {orders.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>
                  No orders placed yet in this session.
                </div>
              ) : (
                orders.map(order => (
                  <li key={order.id} className="list-item-container">
                    <div className="list-item" onClick={() => toggleExpanded(order.id)} style={{ cursor: 'pointer' }}>
                      <div className="item-info">
                        <div className="item-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {expandedOrders.has(order.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          Order {order.id.split('-')[0]}...
                        </div>
                        <div className="item-subtitle">
                          {order.items.map(i => {
                             const invItem = inventory.find(inv => inv.productId === i.productId);
                             return `${i.quantity}x ${invItem ? invItem.sku : i.productId.substring(0, 8)}`;
                          }).join(', ')} 
                          &nbsp;&bull;&nbsp; ${order.totalAmount}
                        </div>
                      </div>
                      <div>
                        <span className={`status-badge ${order.status.toLowerCase()}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                    
                    {expandedOrders.has(order.id) && order.sagaSteps && (
                      <div className="saga-timeline-container">
                        <div className="saga-timeline">
                          {order.sagaSteps.map((step, idx) => {
                            const isLast = idx === order.sagaSteps!.length - 1;
                            const isFailed = step.status === 'FAILED';
                            const isSuccess = step.status === 'SUCCESS';
                            const isProcessing = step.status === 'PROCESSING';
                            
                            return (
                              <div key={step.step} className="timeline-step">
                                <div className="timeline-icon-container">
                                  {isSuccess ? (
                                    <CheckCircle2 size={24} className="icon-success" />
                                  ) : isFailed ? (
                                    <XCircle size={24} className="icon-failed" />
                                  ) : isProcessing ? (
                                    <CircleDashed size={24} className="icon-processing animate-spin" />
                                  ) : (
                                    <Clock size={24} className="icon-pending" />
                                  )}
                                  {!isLast && (
                                    <div className={`timeline-connector ${isSuccess ? 'connector-success' : ''}`} />
                                  )}
                                </div>
                                <div className="timeline-content">
                                  <div className="timeline-title">
                                    {step.step.replace('_', ' ')}
                                    <span className="timeline-time">
                                      {new Date(step.timestamp).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <div className={`timeline-message ${isFailed ? 'text-danger' : ''}`}>
                                    {step.message}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
