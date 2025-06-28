# Use Node.js 18 LTS as base image
FROM node:18-alpine as build

# Set working directory
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy backend package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy backend code
COPY . .

# Build React frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install && npm run build

# Move build output to backend
WORKDIR /app
RUN mkdir -p client/build && cp -r client/build /app/client/

# Create logs directory and set permissions
RUN mkdir -p logs && chmod 755 logs

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (Railway will override this)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application
CMD ["npm", "start"] 