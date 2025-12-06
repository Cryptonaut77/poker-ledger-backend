import { createMiddleware } from "hono/factory";
import { type AppType } from "../types";

/**
 * Authentication middleware that requires a valid session
 * Returns 401 Unauthorized if user is not authenticated
 */
export const requireAuth = createMiddleware<AppType>(async (c, next) => {
  const user = c.get("user");

  if (!user) {
    console.log("🔒 [Auth] Unauthorized access attempt");
    return c.json({ error: "Unauthorized - Please sign in" }, 401);
  }

  console.log(`🔓 [Auth] Authenticated user: ${user.email}`);
  await next();
});
