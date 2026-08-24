// ============================================
// Prisma Database Client
// ============================================
// This is a singleton instance of the Prisma client
// Used throughout the application for database operations
//
// Usage:
//   import { db } from "./db";
//   const users = await db.user.findMany();
//
// The Prisma schema is located at prisma/schema.prisma
// After modifying the schema, run: bunx prisma generate

// Import PrismaClient after dotenv has loaded the environment variables
import { PrismaClient } from "../generated/prisma";

console.log(`[Prisma] DATABASE_URL: ${process.env.DATABASE_URL}`);

const prismaClient = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

export const db = prismaClient;
