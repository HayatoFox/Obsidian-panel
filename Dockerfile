# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy source
COPY backend/ ./

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Create data directory
RUN mkdir -p /app/data /var/lib/obsidian-panel/servers

# Expose port
EXPOSE 3001

# Start server
CMD ["npm", "start"]
