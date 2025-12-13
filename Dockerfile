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
COPY --from=install /app/node_modules ./node_modules
COPY --from=install /app/prisma ./prisma
COPY --from=install /app/generated ./generated
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "bunx prisma migrate deploy && bun run src/index.ts"]
