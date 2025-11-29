import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  type GetActiveGameResponse,
  type GetActiveTablesResponse,
  createTableRequestSchema,
  type CreateTableResponse,
  endGameRequestSchema,
  type EndGameResponse,
  type GameSummary,
  type DeleteGameResponse,
  type StartNewGameResponse,
} from "@/shared/contracts";
import { type AppType } from "../types";
import { db } from "../db";

const gameRouter = new Hono<AppType>();

// ============================================
// GET /api/game/active - Get or create active game session
// ============================================
gameRouter.get("/active", async (c) => {
  console.log("🎮 [Game] Getting active game session");

  // Find active game sessions (now can be multiple)
  let sessions = await db.gameSession.findMany({
    where: { isActive: true },
    orderBy: { startedAt: "desc" },
  });

  // Create new session if none exists
  if (sessions.length === 0) {
    console.log("🎮 [Game] No active session found, creating new one");
    const session = await db.gameSession.create({
      data: {
        name: "Poker Game",
        tableName: "Main Table",
        isActive: true,
      },
    });
    console.log(`🎮 [Game] Created new session: ${session.id}`);
    sessions = [session];
  } else {
    console.log(`🎮 [Game] Found ${sessions.length} active session(s)`);
  }

  // Return the most recent active session
  const session = sessions[0];

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
// GET /api/game/tables - Get all active tables
// ============================================
gameRouter.get("/tables", async (c) => {
  console.log("🎮 [Game] Getting all active tables");

  const sessions = await db.gameSession.findMany({
    where: { isActive: true },
    orderBy: { startedAt: "desc" },
  });

  console.log(`🎮 [Game] Found ${sessions.length} active table(s)`);

  return c.json({
    tables: sessions.map((s) => ({
      ...s,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  } satisfies GetActiveTablesResponse);
});

// ============================================
// POST /api/game/table - Create a new table
// ============================================
gameRouter.post("/table", zValidator("json", createTableRequestSchema), async (c) => {
  const { tableName } = c.req.valid("json");
  console.log(`🎮 [Game] Creating new table: ${tableName}`);

  const session = await db.gameSession.create({
    data: {
      name: "Poker Game",
      tableName,
      isActive: true,
    },
  });

  console.log(`🎮 [Game] Table created: ${session.id}`);

  return c.json({
    session: {
      ...session,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
  } satisfies CreateTableResponse);
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
// DELETE /api/game/:sessionId - Delete a game session
// ============================================
gameRouter.delete("/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  console.log(`🎮 [Game] Deleting session: ${sessionId}`);

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
  console.log("🎮 [Game] Creating new game session");

  // Don't end other active sessions - allow multiple tables
  // Just create a new session
  const session = await db.gameSession.create({
    data: {
      name: "Poker Game",
      tableName: "New Table",
      isActive: true,
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

  // Only count paid tips for calculations
  const totalPaidTips = session.dealerDowns
    .filter((d) => d.tipsPaid)
    .reduce((sum, d) => sum + d.tips, 0);

  // Only count rake from downs where tips have been paid
  const totalPaidRake = session.dealerDowns
    .filter((d) => d.tipsPaid)
    .reduce((sum, d) => sum + d.rake, 0);

  // House profit = Paid Rake - Expenses
  // Only count rake that has been claimed (tips paid)
  const netProfit = totalPaidRake - totalExpenses;

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
    tillBalance,
    playerCount,
  } satisfies GameSummary);
});

export { gameRouter };
