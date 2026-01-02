import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { type AppType } from "../types";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";

const shareRouter = new Hono<AppType>();

// Apply auth middleware to all share routes
shareRouter.use("*", requireAuth);

// Generate a random 6-character share code
function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous chars (0, O, 1, I)
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================
// POST /api/share/generate - Generate a share code for current game
// ============================================
shareRouter.post("/generate", async (c) => {
  const user = c.get("user")!;
  console.log(`🔗 [Share] Generating share code for user: ${user.email}`);

  try {
    // Find the user's active game session
    const gameSession = await db.gameSession.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!gameSession) {
      return c.json({ error: "No active game session found" }, 404);
    }

    // Generate a unique share code
    let shareCode = generateShareCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.gameSession.findUnique({
        where: { shareCode },
      });
      if (!existing) break;
      shareCode = generateShareCode();
      attempts++;
    }

    // Set expiration to 24 hours from now
    const shareCodeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Update the game session with the share code
    const updated = await db.gameSession.update({
      where: { id: gameSession.id },
      data: { shareCode, shareCodeExpiresAt },
    });

    console.log(`🔗 [Share] Generated share code: ${shareCode} for session: ${gameSession.id}`);

    return c.json({
      shareCode: updated.shareCode,
      expiresAt: updated.shareCodeExpiresAt?.toISOString(),
    });
  } catch (error: any) {
    console.error("🔗 [Share] Error generating share code:", error);
    return c.json({ error: error.message || "Failed to generate share code" }, 500);
  }
});

// ============================================
// POST /api/share/join - Join a game using share code
// ============================================
const joinSchema = z.object({
  shareCode: z.string().length(6),
});

shareRouter.post("/join", zValidator("json", joinSchema), async (c) => {
  const user = c.get("user")!;
  const { shareCode } = c.req.valid("json");
  console.log(`🔗 [Share] User ${user.email} attempting to join with code: ${shareCode}`);

  try {
    // Find the game session with this share code
    const gameSession = await db.gameSession.findUnique({
      where: { shareCode: shareCode.toUpperCase() },
      include: { user: true },
    });

    if (!gameSession) {
      return c.json({ error: "Invalid share code" }, 404);
    }

    // Check if share code has expired
    if (gameSession.shareCodeExpiresAt && new Date() > gameSession.shareCodeExpiresAt) {
      return c.json({ error: "Share code has expired" }, 400);
    }

    // Check if user is already a member
    const existingMember = await db.gameSessionMember.findUnique({
      where: {
        userId_gameSessionId: {
          userId: user.id,
          gameSessionId: gameSession.id,
        },
      },
    });

    if (existingMember) {
      return c.json({ error: "You are already a member of this game" }, 400);
    }

    // Check if user is the owner
    if (gameSession.userId === user.id) {
      return c.json({ error: "You are the owner of this game" }, 400);
    }

    // Add user as a member
    await db.gameSessionMember.create({
      data: {
        userId: user.id,
        gameSessionId: gameSession.id,
        role: "editor",
      },
    });

    console.log(`🔗 [Share] User ${user.email} joined game: ${gameSession.id}`);

    return c.json({
      success: true,
      gameName: gameSession.name,
      ownerName: gameSession.user.name,
    });
  } catch (error: any) {
    console.error("🔗 [Share] Error joining game:", error);
    return c.json({ error: error.message || "Failed to join game" }, 500);
  }
});

// ============================================
// GET /api/share/members - Get all members of current game
// ============================================
shareRouter.get("/members", async (c) => {
  const user = c.get("user")!;
  console.log(`🔗 [Share] Getting members for user: ${user.email}`);

  try {
    // Find the user's active game session (owned or member)
    const ownedSession = await db.gameSession.findFirst({
      where: { userId: user.id, isActive: true },
    });

    const memberSession = await db.gameSessionMember.findFirst({
      where: { userId: user.id, gameSession: { isActive: true } },
      include: { gameSession: true },
    });

    const gameSession = ownedSession || memberSession?.gameSession;

    if (!gameSession) {
      return c.json({ error: "No active game session found" }, 404);
    }

    // Get the owner
    const owner = await db.user.findUnique({
      where: { id: gameSession.userId },
      select: { id: true, name: true, email: true, initials: true },
    });

    // Get all members
    const members = await db.gameSessionMember.findMany({
      where: { gameSessionId: gameSession.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, initials: true },
        },
      },
    });

    return c.json({
      owner: owner ? { ...owner, role: "owner" } : null,
      members: members.map((m) => ({
        ...m.user,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
      shareCode: gameSession.shareCode,
      shareCodeExpiresAt: gameSession.shareCodeExpiresAt?.toISOString(),
    });
  } catch (error: any) {
    console.error("🔗 [Share] Error getting members:", error);
    return c.json({ error: error.message || "Failed to get members" }, 500);
  }
});

// ============================================
// DELETE /api/share/member/:userId - Remove a member from the game
// ============================================
shareRouter.delete("/member/:userId", async (c) => {
  const user = c.get("user")!;
  const memberUserId = c.req.param("userId");
  console.log(`🔗 [Share] User ${user.email} removing member: ${memberUserId}`);

  try {
    // Find the user's active game session (must be owner)
    const gameSession = await db.gameSession.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!gameSession) {
      return c.json({ error: "You must be the game owner to remove members" }, 403);
    }

    // Remove the member
    await db.gameSessionMember.delete({
      where: {
        userId_gameSessionId: {
          userId: memberUserId,
          gameSessionId: gameSession.id,
        },
      },
    });

    console.log(`🔗 [Share] Member ${memberUserId} removed from game: ${gameSession.id}`);

    return c.json({ success: true });
  } catch (error: any) {
    console.error("🔗 [Share] Error removing member:", error);
    return c.json({ error: error.message || "Failed to remove member" }, 500);
  }
});

// ============================================
// DELETE /api/share/code - Revoke the current share code
// ============================================
shareRouter.delete("/code", async (c) => {
  const user = c.get("user")!;
  console.log(`🔗 [Share] Revoking share code for user: ${user.email}`);

  try {
    // Find the user's active game session (must be owner)
    const gameSession = await db.gameSession.findFirst({
      where: { userId: user.id, isActive: true },
    });

    if (!gameSession) {
      return c.json({ error: "You must be the game owner to revoke share codes" }, 403);
    }

    // Remove the share code
    await db.gameSession.update({
      where: { id: gameSession.id },
      data: { shareCode: null, shareCodeExpiresAt: null },
    });

    console.log(`🔗 [Share] Share code revoked for game: ${gameSession.id}`);

    return c.json({ success: true });
  } catch (error: any) {
    console.error("🔗 [Share] Error revoking share code:", error);
    return c.json({ error: error.message || "Failed to revoke share code" }, 500);
  }
});

export { shareRouter };
