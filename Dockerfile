# Build Node.js Production Image
FROM node:24-alpine AS runner

WORKDIR /app

# Install native compilation dependencies for SQLite
RUN apk add --no-cache python3 make g++

# Copy backend package manifests
COPY backend/package*.json ./backend/

WORKDIR /app/backend
RUN npm ci --omit=dev

# Copy entire project source
WORKDIR /app
COPY . .

# Initialize and seed database if not present
WORKDIR /app/backend
RUN npm run seed

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "server.js"]
