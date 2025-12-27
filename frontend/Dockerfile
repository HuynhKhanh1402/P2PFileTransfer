# Production Dockerfile for Frontend
# Multi-stage build for optimized production image

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies for build
RUN npm ci

# Copy source files
COPY . .

# Build arguments for Vite
ARG VITE_API_URL
ARG VITE_SOCKET_URL

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

# Build the application (skip TypeScript check as project uses JSX)
RUN npx vite build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install serve to serve static files
RUN npm install -g serve

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 5173

# Serve the built application
CMD ["serve", "-s", "dist", "-l", "5173"]
