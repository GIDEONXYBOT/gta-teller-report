# Backend Dockerfile
FROM node:20-alpine

WORKDIR /usr/src/app

# Install production dependencies only
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy source
COPY backend/ ./

# Ensure uploads directory
RUN mkdir -p /usr/src/app/uploads

EXPOSE 5000

# Use PORT env var if set
ENV PORT=5000

CMD ["node", "server.js"]
