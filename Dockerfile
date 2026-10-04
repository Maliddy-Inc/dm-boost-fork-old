# SocialCrabs / DM Boost Docker Image
# Playwright base image version must match the `playwright` npm package version

# ---- Build stage (TypeScript -> dist, platform independent) ----
FROM --platform=$BUILDPLATFORM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM mcr.microsoft.com/playwright:v1.58.1-noble

WORKDIR /app

# Install production dependencies (browsers are preinstalled in the base image)
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=build /app/dist ./dist
COPY public ./public

# Create directories for persistent data
RUN mkdir -p /app/sessions /app/browser-data /app/logs && chown -R pwuser:pwuser /app

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=3847
ENV WS_PORT=3848
ENV HOST=0.0.0.0
ENV BROWSER_HEADLESS=true
ENV BROWSER_DATA_DIR=/app/browser-data
ENV SESSION_DIR=/app/sessions
ENV LOG_LEVEL=info
ENV LOG_FILE=/app/logs/socialcrabs.log

# Expose ports
EXPOSE 3847 3848

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3847/health || exit 1

# Run as non-root user
USER pwuser

# Start server
CMD ["node", "dist/cli.js", "serve", "--host", "0.0.0.0"]
