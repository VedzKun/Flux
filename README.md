# Distributed Order Processing System

A production-grade scalable backend system designed for high-throughput e-commerce processes utilizing a microservices architecture. It strictly isolates the Order, Inventory, and Payment logic, allowing those services to scale independently.

## Features Profile
- **High Concurrency Resiliency**: Built with Node.js and decoupled via RabbitMQ Saga Choreography.
- **Microservice Separation**:
  - `Order Service`: Handles HTTP ingestion and overall status tracking (`3001`).
  - `Inventory Service`: Tracks and reserves stock, using Postgres Row Locks and Redis Caching (`3002`).
  - `Payment Service`: Provides mock transactional processing (simulated cards).
- **Event-Driven**: Async communication ensures the system doesn't fail globally if one service is slow or down. Messages are queued dynamically in RabbitMQ.

## Quick Start (Docker)

Ensure you have Docker and Docker Compose installed.

```bash
docker-compose up --build -d
```
This will initialize:
- Postgres (Port 5432)
- Redis (Port 6379)
- RabbitMQ (Port 5672/15672)
- Order Service (Port 3001)
- Inventory Service (Port 3002)
- Payment Service (Worker)

### Testing the System
Check the inventory first:
```bash
curl http://localhost:3002/inventory
```

Place an order:
```bash
curl -X POST -H "Content-Type: application/json" -d '{"userId":"user123","items":[{"productId":"11111111-1111-1111-1111-111111111111","quantity":1}]}' http://localhost:3001/orders
```

View the order processing status (replace `ID` with the returned order ID):
```bash
curl http://localhost:3001/orders/ID
```

Alternatively, run the automated E2E test script to observe the flow:
```bash
node test-e2e.js
```

## System Architecture

> User -> API -> [Order Service]
>                  | -> [Redis Cache]
>                  | -> [DB: orders]
>             [RabbitMQ `order.created`] -> [Inventory Service]
>                                             | -> [DB: inventory] (Row lock, Reserve)
>             [RabbitMQ `inventory.reserved`] -> [Payment Service]
>                                             | -> Mock process -> Success/Fail
>             [RabbitMQ `payment.success` / `failed`] -> [Inventory Service] (Commit/Release)
>                                                     -> [Order Service] (Complete/Fail)

**Redis**: Used in the Order Service to store heavily loaded lookup states, and inside the Inventory Service to cache total available stock for fast reads without overloading Postgres.

**PostgreSQL**: Handles eventual consistency using strict `FOR UPDATE` row locking during reservation.
