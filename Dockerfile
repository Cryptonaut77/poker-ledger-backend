FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY package.json ./
COPY prisma ./prisma/
RUN bun install

# Generate Prisma client
RUN bunx prisma generate

# Production image
FROM base AS release
# Install sqlite3 CLI for database backups
RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*
COPY --from=install /app/node_modules ./node_modules
COPY --from=install /app/prisma ./prisma
COPY --from=install /app/generated ./generated
COPY . .

# Create persistent data directory for SQLite in production
RUN mkdir -p /data

ENV NODE_ENV=production
ENV ENVIRONMENT=production
EXPOSE 3000

# Use the start script which properly handles production DB setup
RUN chmod +x scripts/start scripts/env.sh
CMD ["scripts/start"]
