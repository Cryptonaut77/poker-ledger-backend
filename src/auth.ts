import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { env } from "./env";
import { db } from "./db";
// ============================================
// Better Auth Configuration
// ============================================
// Better Auth handles all authentication flows for the application
// Endpoints are automatically mounted at /api/auth/* in index.ts
//
// Available endpoints:
//   - POST /api/auth/sign-up/email       - Sign up with email/password
//   - POST /api/auth/sign-in/email       - Sign in with email/password
//   - POST /api/auth/sign-out            - Sign out current session
//   - GET  /api/auth/session             - Get current session
//   - And many more... (see Better Auth docs)
//
// This configuration includes:
//   - Prisma adapter for SQLite database
//   - Expo plugin for React Native support
//   - Email/password authentication
//   - Trusted origins for CORS
console.log("🔐 [Auth] Initializing Better Auth...");
export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "sqlite",
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BACKEND_URL,
  plugins: [expo()],
  trustedOrigins: (request) => {
    const origins = [
      "pokernightledger://",
      "http://localhost:3000",
      "https://absently-hence.vibecode.run",
    ];
    // Dynamically trust the origin from the request if it matches Vibecode patterns
    const origin = request.headers.get("origin") || "";
    if (
      origin.endsWith(".vibecode.run") ||
      origin.endsWith(".share.sandbox.dev") ||
      origin.startsWith("http://localhost")
    ) {
      origins.push(origin);
    }
    return origins;
  },
  emailAndPassword: {
    enabled: true,
  },
});
console.log("✅ [Auth] Better Auth initialized");
console.log(`🌐 [Auth] Trusted origins: dynamic (pokernightledger://, *.vibecode.run, *.share.sandbox.dev)`);
