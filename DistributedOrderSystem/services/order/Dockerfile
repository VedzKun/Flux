FROM node:20-alpine AS builder

WORKDIR /app

# Copy root configurations
COPY package*.json ./
COPY tsconfig.json ./

# Copy specific workspace setup
COPY packages/shared/package*.json ./packages/shared/
COPY services/order/package*.json ./services/order/
COPY services/inventory/package*.json ./services/inventory/
COPY services/payment/package*.json ./services/payment/

# Install all dependencies (workspaces mapped)
RUN npm install

# Copy source code
COPY packages/shared ./packages/shared
COPY services/order ./services/order

# Build shared and order service
WORKDIR /app/packages/shared
RUN npm run build
WORKDIR /app/services/order
RUN npm run build

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/order/dist ./services/order/dist
COPY --from=builder /app/services/order/package*.json ./services/order/

CMD ["node", "services/order/dist/index.js"]
