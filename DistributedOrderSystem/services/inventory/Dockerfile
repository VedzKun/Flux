FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

COPY packages/shared/package*.json ./packages/shared/
COPY services/order/package*.json ./services/order/
COPY services/inventory/package*.json ./services/inventory/
COPY services/payment/package*.json ./services/payment/

RUN npm install

COPY packages/shared ./packages/shared
COPY services/inventory ./services/inventory

WORKDIR /app/packages/shared
RUN npm run build
WORKDIR /app/services/inventory
RUN npm run build

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/inventory/dist ./services/inventory/dist
COPY --from=builder /app/services/inventory/package*.json ./services/inventory/

CMD ["node", "services/inventory/dist/index.js"]
