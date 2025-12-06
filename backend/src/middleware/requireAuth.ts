import { createMiddleware } from "hono/factory";
import { type AppType } from "../types";
import { db } from "../db";

// DEV MODE: Skip authentication for development
const DEV_SKIP_AUTH = true;
const DEV_USER_EMAIL = "dev@example.com";

/**
 * Authentication middleware that requires a valid session
 * Returns 401 Unauthorized if user is not authenticated
 * In dev mode, creates/uses a dev user automatically
 */
export const requireAuth = createMiddleware<AppType>(async (c, next) => {
  // DEV MODE: Create or get dev user and bypass auth
  if (DEV_SKIP_AUTH) {
    let devUser = await db.user.findUnique({
      where: { email: DEV_USER_EMAIL },
    });

    if (!devUser) {
      devUser = await db.user.create({
        data: {
          id: "dev-user-id",
          email: DEV_USER_EMAIL,
          name: "Dev User",
          emailVerified: true,
        },
      });
      console.log("🔧 [Auth] Created dev user for development mode");
    }

    c.set("user", devUser);
    console.log(`🔧 [Auth] Dev mode - using dev user: ${devUser.email}`);
    await next();
    return;
  }

  const user = c.get("user");

  if (!user) {
    console.log("🔒 [Auth] Unauthorized access attempt");
    return c.json({ error: "Unauthorized - Please sign in" }, 401);
  }

  console.log(`🔓 [Auth] Authenticated user: ${user.email}`);
  await next();
});
