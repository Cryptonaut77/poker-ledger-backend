import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  type GetActiveGameResponse,
  endGameRequestSchema,
  type EndGameResponse,
  type GameSummary,
} from "@/shared/contracts";
import { type AppType } from "../types";
import { db } from "../db";

const gameRouter = new Hono<AppType>();

// ============================================
// GET /api/game/active - Get or create active game session
// ============================================
gameRouter.get("/active", async (c) => {
  console.log("🎮 [Game] Getting active game session");

  // Find active game session
  let session = await db.gameSession.findFirst({
    where: { isActive: true },
    orderBy: { startedAt: "desc" },
  });

  // Create new session if none exists
  if (!session) {
    console.log("🎮 [Game] No active session found, creating new one");
    session = await db.gameSession.create({
      data: {
        name: "Poker Game",
        isActive: true,
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
});

// ============================================
// POST /api/game/end - End current game session
// ============================================
gameRouter.post("/end", zValidator("json", endGameRequestSchema), async (c) => {
  const { sessionId } = c.req.valid("json");
  console.log(`🎮 [Game] Ending session: ${sessionId}`);

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
// GET /api/game/:sessionId/summary - Get game session summary
// ============================================
gameRouter.get("/:sessionId/summary", async (c) => {
  const sessionId = c.req.param("sessionId");
  console.log(`🎮 [Game] Getting summary for session: ${sessionId}`);

  const session = await db.gameSession.findUnique({
    where: { id: sessionId },
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

  const netProfit = totalBuyIns - totalCashouts + totalTips + totalRake - totalExpenses;

  // Count unique players
  const uniquePlayers = new Set(session.playerTransactions.map((t) => t.playerName));
  const playerCount = uniquePlayers.size;

  console.log(`🎮 [Game] Summary calculated - Net profit: $${netProfit.toFixed(2)}`);

  return c.json({
    session: {
      ...session,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
    totalBuyIns,
    totalCashouts,
    totalTips,
    totalRake,
    totalExpenses,
    netProfit,
    playerCount,
  } satisfies GameSummary);
});

export { gameRouter };
