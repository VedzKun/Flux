const http = require('http');

const delay = (ms) => new Promise(res => setTimeout(res, ms));

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runE2E() {
  console.log("🚀 Starting E2E Test on Distributed Order System\n");

  try {
    // 1. Check Inventory
    console.log(">> Checking Initial Inventory...");
    let invRes = await request({ hostname: 'localhost', port: 3002, path: '/inventory', method: 'GET' });
    console.log(`Inventory Status (${invRes.status}):`, invRes.data);

    // Pick an item from inventory to order if available
    if (invRes.data && invRes.data.length > 0) {
      const itemToOrder = invRes.data[0];

      // 2. Place Order
      console.log(`\n>> Placing Order for SKU: ${itemToOrder.sku}...`);
      const payload = {
        userId: 'user-e2e-tester',
        items: [{ productId: itemToOrder.productId, quantity: 2 }]
      };
      
      let orderRes = await request({ 
        hostname: 'localhost', 
        port: 3001, 
        path: '/orders', 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, payload);

      console.log(`Order Placed (${orderRes.status}):`, orderRes.data);
      const orderId = orderRes.data.orderId;

      // 3. Poll Order Status (waiting for Payment & Inventory Saga to complete)
      console.log(`\n>> Polling Order Status for ID: ${orderId}...`);
      for (let i = 0; i < 5; i++) {
        await delay(2000); // wait 2s between polls
        let statusRes = await request({ hostname: 'localhost', port: 3001, path: `/orders/${orderId}`, method: 'GET' });
        console.log(`Poll ${i+1} Status:`, statusRes.data.status);
        
        if (statusRes.data.status === 'COMPLETED' || statusRes.data.status === 'FAILED') {
          console.log(`\n✅ Final Order State Reached: ${statusRes.data.status}`);
          break;
        }
      }

      // 4. Check Final Inventory
      console.log("\n>> Checking Final Inventory...");
      let finalInvRes = await request({ hostname: 'localhost', port: 3002, path: '/inventory', method: 'GET' });
      console.log(`Inventory Status (${finalInvRes.status}):`, finalInvRes.data);
    } else {
      console.log("No inventory seeded. Make sure services are running.");
    }
  } catch (err) {
    console.error("Test failed to connect. Ensure services are running using docker-compose.", err);
  }
}

runE2E();
