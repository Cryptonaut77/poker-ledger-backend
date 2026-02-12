// MUST LOAD FIRST: Load environment variables from .env file before anything else
import { config } from "dotenv";
import path from "path";

const envPath = path.resolve(import.meta.dir, "../.env");
console.log(`[dotenv] Loading from: ${envPath}`);
const result = config({ path: envPath, override: true });
console.log(`[dotenv] Loaded vars: ${Object.keys(result.parsed || {}).length}`);
console.log(`[dotenv] DATABASE_URL after load: ${process.env.DATABASE_URL}`);

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { auth } from "./auth";
import { env } from "./env";
import { gameRouter } from "./routes/game";
import { playersRouter } from "./routes/players";
import { dealersRouter } from "./routes/dealers";
import { expensesRouter } from "./routes/expenses";
import { shareRouter } from "./routes/share";
import { aiRouter } from "./routes/ai";
import { type AppType } from "./types";

// AppType context adds user and session to the context, will be null if the user or session is null
const app = new Hono<AppType>();

console.log("🔧 Initializing Hono application...");
app.use("*", logger());

// Add custom request logger to debug 502 issues
app.use("*", async (c, next) => {
  console.log(`📨 [REQUEST] ${c.req.method} ${c.req.url}`);
  console.log(`📨 [REQUEST] Path: ${c.req.path}`);
  await next();
  console.log(`✅ [RESPONSE] ${c.req.method} ${c.req.url} - Status: ${c.res.status}`);
});

app.use(
  "/*",
  cors({
    origin: (origin) => origin || "*", // Allow the requesting origin or fallback to *
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

// Global error handler
app.onError((err, c) => {
  console.error("🚨 [ERROR]", err);
  console.error("🚨 [ERROR] Stack:", err.stack);

  // Return a proper error response
  return c.json(
    {
      error: err.message || "Internal server error",
      details: process.env.NODE_ENV === "development" ? err.stack : undefined,
    },
    500
  );
});

/** Authentication middleware
 * Extracts session from request headers and attaches user/session to context
 * All routes can access c.get("user") and c.get("session")
 */
app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", session?.user ?? null); // type: typeof auth.$Infer.Session.user | null
  c.set("session", session?.session ?? null); // type: typeof auth.$Infer.Session.session | null
  return next();
});

// Better Auth handler
// Handles all authentication endpoints: /api/auth/sign-in, /api/auth/sign-up, etc.
console.log("🔐 Mounting Better Auth handler at /api/auth/*");
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Mount route modules
console.log("🎮 Mounting game routes at /api/game");
app.route("/api/game", gameRouter);

console.log("💰 Mounting player routes at /api/players");
app.route("/api/players", playersRouter);

console.log("🎲 Mounting dealer routes at /api/dealers");
app.route("/api/dealers", dealersRouter);

console.log("💸 Mounting expense routes at /api/expenses");
app.route("/api/expenses", expensesRouter);

console.log("🔗 Mounting share routes at /api/share");
app.route("/api/share", shareRouter);

console.log("🤖 Mounting AI routes at /api/ai");
app.route("/api/ai", aiRouter);

// Health check endpoint
// Used by load balancers and monitoring tools to verify service is running
app.get("/health", (c) => {
  console.log("💚 Health check requested");
  return c.json({ status: "ok" });
});

// Start the server
console.log("⚙️  Starting server...");
serve({ fetch: app.fetch, port: Number(env.PORT) }, () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📍 Environment: ${env.NODE_ENV}`);
  console.log(`🚀 Server is running on port ${env.PORT}`);
  console.log(`🔗 Base URL: http://localhost:${env.PORT}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n📚 Available endpoints:");
  console.log("  🔐 Auth:     /api/auth/*");
  console.log("  🎮 Game:     GET /api/game/active, POST /api/game/end, GET /api/game/:id/summary");
  console.log("  💰 Players:  POST /api/players/transaction, GET /api/players/transactions/:sessionId");
  console.log("  🎲 Dealers:  POST /api/dealers/down, GET /api/dealers/downs/:sessionId");
  console.log("  💸 Expenses: POST /api/expenses, GET /api/expenses/:sessionId");
  console.log("  💚 Health:   GET /health");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});
