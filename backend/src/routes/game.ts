import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  type GetActiveGameResponse,
  endGameRequestSchema,
  type EndGameResponse,
  type GameSummary,
  type DeleteGameResponse,
  type StartNewGameResponse,
  type GetGameHistoryResponse,
} from "@/shared/contracts";
import { type AppType } from "../types";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";

const gameRouter = new Hono<AppType>();

// Apply auth middleware to all game routes
gameRouter.use("*", requireAuth);

// ============================================
// GET /api/game/active - Get or create active game session
// ============================================
gameRouter.get("/active", async (c) => {
  const user = c.get("user")!;
  console.log(`🎮 [Game] Getting active game session for user: ${user.email}`);

  try {
    // Find active game session for this user
    let session = await db.gameSession.findFirst({
      where: { isActive: true, userId: user.id },
      orderBy: { startedAt: "desc" },
    });

    // Create new session if none exists
    if (!session) {
      console.log("🎮 [Game] No active session found, creating new one");
      session = await db.gameSession.create({
        data: {
          name: "Poker Game",
          tableName: "Main Table",
          isActive: true,
          userId: user.id,
        },
      });
      console.log(`🎮 [Game] Created new session: ${session.id}`);
    } else {
      console.log(`🎮 [Game] Found active session: ${session.id}`);
    }

    return c.json({
      session: {
        ...session,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt?.toISOString() ?? null,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
    } satisfies GetActiveGameResponse);
  } catch (error: any) {
    console.error("❌ [Game] Error getting active game:", error);
    return c.json({ error: "Failed to get active game session", details: error.message }, 500);
  }
});

// ============================================
// GET /api/game/history - Get all inactive game sessions
// ============================================
gameRouter.get("/history", async (c) => {
  const user = c.get("user")!;
  console.log(`🎮 [Game] Getting game history for user: ${user.email}`);

  const sessions = await db.gameSession.findMany({
    where: { isActive: false, userId: user.id },
    orderBy: { endedAt: "desc" },
    include: {
      playerTransactions: true,
      dealerDowns: true,
      expenses: true,
    },
  });

  console.log(`🎮 [Game] Found ${sessions.length} inactive sessions`);

  return c.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      name: session.name,
      tableName: session.tableName,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      isActive: session.isActive,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      playerTransactions: session.playerTransactions.map((t) => ({
        id: t.id,
        playerName: t.playerName,
        type: t.type as "buy-in" | "cashout",
        amount: t.amount,
        paymentMethod: t.paymentMethod as "cash" | "electronic" | "credit",
        notes: t.notes,
        timestamp: t.timestamp.toISOString(),
        gameSessionId: t.gameSessionId,
      })),
      dealerDowns: session.dealerDowns.map((d) => ({
        id: d.id,
        dealerName: d.dealerName,
        tips: d.tips,
        rake: d.rake,
        tipsPaid: d.tipsPaid,
        timestamp: d.timestamp.toISOString(),
        gameSessionId: d.gameSessionId,
      })),
      expenses: session.expenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        category: e.category as "food" | "drinks" | "other",
        notes: e.notes,
        timestamp: e.timestamp.toISOString(),
        gameSessionId: e.gameSessionId,
      })),
    })),
  } satisfies GetGameHistoryResponse);
});

// ============================================
// POST /api/game/end - End current game session
// ============================================
gameRouter.post("/end", zValidator("json", endGameRequestSchema), async (c) => {
  const user = c.get("user")!;
  const { sessionId } = c.req.valid("json");
  console.log(`🎮 [Game] Ending session: ${sessionId} for user: ${user.email}`);

  // Verify the session belongs to this user
  const existingSession = await db.gameSession.findFirst({
    where: { id: sessionId, userId: user.id },
  });

  if (!existingSession) {
    return c.json({ error: "Game session not found" }, 404);
  }

  const session = await db.gameSession.update({
    where: { id: sessionId },
    data: {
      isActive: false,
      endedAt: new Date(),
    },
  });

  console.log(`🎮 [Game] Session ended: ${session.id}`);

  return c.json({
    success: true,
    session: {
      ...session,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
  } satisfies EndGameResponse);
});

// ============================================
// DELETE /api/game/:sessionId - Delete a game session
// ============================================
gameRouter.delete("/:sessionId", async (c) => {
  const user = c.get("user")!;
  const sessionId = c.req.param("sessionId");
  console.log(`🎮 [Game] Deleting session: ${sessionId} for user: ${user.email}`);

  // Verify the session belongs to this user
  const existingSession = await db.gameSession.findFirst({
    where: { id: sessionId, userId: user.id },
  });

  if (!existingSession) {
    return c.json({ error: "Game session not found" }, 404);
  }

  await db.gameSession.delete({
    where: { id: sessionId },
  });

  console.log(`🎮 [Game] Session deleted: ${sessionId}`);

  return c.json({ success: true } satisfies DeleteGameResponse);
});

// ============================================
// POST /api/game/new - Start a new game session
// ============================================
gameRouter.post("/new", async (c) => {
  const user = c.get("user")!;
  console.log(`🎮 [Game] Creating new game session for user: ${user.email}`);

  // First, end any active sessions for this user
  await db.gameSession.updateMany({
    where: { isActive: true, userId: user.id },
    data: {
      isActive: false,
      endedAt: new Date(),
    },
  });

  // Create new session
  const session = await db.gameSession.create({
    data: {
      name: "Poker Game",
      tableName: "Main Table",
      isActive: true,
      userId: user.id,
    },
  });

  console.log(`🎮 [Game] New session created: ${session.id}`);

  return c.json({
    session: {
      ...session,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
  } satisfies StartNewGameResponse);
});

// ============================================
// GET /api/game/:sessionId/summary - Get game session summary
// ============================================
gameRouter.get("/:sessionId/summary", async (c) => {
  const user = c.get("user")!;
  const sessionId = c.req.param("sessionId");
  console.log(`🎮 [Game] ============ SUMMARY REQUEST RECEIVED ============`);
  console.log(`🎮 [Game] Getting summary for session: ${sessionId}, user: ${user.email}`);
  console.log(`🎮 [Game] Request URL: ${c.req.url}`);
  console.log(`🎮 [Game] Request method: ${c.req.method}`);

  const session = await db.gameSession.findFirst({
    where: { id: sessionId, userId: user.id },
    include: {
      playerTransactions: true,
      dealerDowns: true,
      expenses: true,
    },
  });

  if (!session) {
    console.log(`❌ [Game] Session not found: ${sessionId}`);
    return c.json({ error: "Session not found" }, 404);
  }

  // Calculate totals
  const totalBuyIns = session.playerTransactions
    .filter((t) => t.type === "buy-in")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalCashouts = session.playerTransactions
    .filter((t) => t.type === "cashout")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalTips = session.dealerDowns.reduce((sum, d) => sum + d.tips, 0);

  const totalRake = session.dealerDowns.reduce((sum, d) => sum + d.rake, 0);

  const totalExpenses = session.expenses.reduce((sum, e) => sum + e.amount, 0);

  // Only count paid tips for calculations
  const totalPaidTips = session.dealerDowns
    .filter((d) => d.tipsPaid)
    .reduce((sum, d) => sum + d.tips, 0);

  // Only count rake that has been claimed (separate from tips paid)
  const totalClaimedRake = session.dealerDowns
    .filter((d) => d.rakeClaimed)
    .reduce((sum, d) => sum + d.rake, 0);

  // House profit = Claimed Rake - Expenses
  // Only count rake that has been claimed
  const netProfit = totalClaimedRake - totalExpenses;

  // Till balance = Physical cash in the till
  // Cash buy-ins add money (money IN)
  // Cashouts remove money (paying players OUT)
  // Paid tips remove money (paying dealers OUT from player buy-ins)
  // Expenses remove money (paying for costs OUT)
  const cashBuyIns = session.playerTransactions
    .filter((t) => t.type === "buy-in" && t.paymentMethod === "cash")
    .reduce((sum, t) => sum + t.amount, 0);
  const tillBalance = cashBuyIns - totalCashouts - totalPaidTips - totalExpenses;

  // Count unique players
  const uniquePlayers = new Set(session.playerTransactions.map((t) => t.playerName));
  const playerCount = uniquePlayers.size;

  console.log(`🎮 [Game] Summary calculated - Net profit: $${netProfit.toFixed(2)}, Till balance: $${tillBalance.toFixed(2)}`);

  // Return clean session object without nested relations to match contract
  return c.json({
    session: {
      id: session.id,
      name: session.name,
      tableName: session.tableName,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      isActive: session.isActive,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
    totalBuyIns,
    totalCashouts,
    totalTips,
    totalRake,
    totalExpenses,
    netProfit,
    tillBalance,
    playerCount,
  } satisfies GameSummary);
});

export { gameRouter };
