import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  type GetActiveGameResponse,
  endGameRequestSchema,
  type EndGameResponse,
  type GameSummary,
  type DeleteGameResponse,
  startNewGameRequestSchema,
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
  console.log(`🎮 [Game] Getting active game session for user: ${user.email}, userId: ${user.id}`);

  try {
    // First, check if user owns an active game
    let session = await db.gameSession.findFirst({
      where: { isActive: true, userId: user.id },
      orderBy: { startedAt: "desc" },
    });

    // If not, check if user is a member of an active game
    if (!session) {
      const membership = await db.gameSessionMember.findFirst({
        where: { userId: user.id, gameSession: { isActive: true } },
        include: { gameSession: true },
      });
      session = membership?.gameSession ?? null;
    }

    // Get fresh user data to check completedGames count
    const currentUser = await db.user.findUnique({
      where: { id: user.id },
      select: { completedGames: true },
    });

    console.log(`🎮 [Game] User ${user.email} has completed ${currentUser?.completedGames ?? 0} games`);

    // Create new session if none exists
    if (!session) {
      console.log(`🎮 [Game] No active session found, creating new one for userId: ${user.id}`);
      session = await db.gameSession.create({
        data: {
          name: "Poker Game",
          tableName: "Main Table",
          isActive: true,
          userId: user.id,
        },
      });
      console.log(`🎮 [Game] Created new session: ${session.id} with owner userId: ${session.userId}`);
    } else {
      console.log(`🎮 [Game] Found active session: ${session.id}, owner userId: ${session.userId}, current userId: ${user.id}`);
    }

    return c.json({
      session: {
        ...session,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt?.toISOString() ?? null,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
      userCompletedGames: currentUser?.completedGames ?? 0,
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

  // Increment completed games counter for the user
  await db.user.update({
    where: { id: user.id },
    data: {
      completedGames: { increment: 1 },
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
gameRouter.post("/new", zValidator("json", startNewGameRequestSchema), async (c) => {
  const user = c.get("user")!;
  const { currency, language } = c.req.valid("json");
  console.log(`🎮 [Game] Creating new game session for user: ${user.email} with currency: ${currency}, language: ${language}`);

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
      currency: currency || "USD",
      language: language || "en",
    },
  });

  console.log(`🎮 [Game] New session created: ${session.id} with currency ${session.currency} and language ${session.language}`);

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

  // Check if user has access (owner or member)
  const session = await db.gameSession.findFirst({
    where: {
      id: sessionId,
      OR: [
        { userId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    },
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

  // Use totalRake from session (logged via dropbox count), fallback to dealer downs sum
  const totalRake = session.totalRake > 0 ? session.totalRake : session.dealerDowns.reduce((sum, d) => sum + d.rake, 0);

  const totalExpenses = session.expenses.reduce((sum, e) => sum + e.amount, 0);

  // Only count paid tips for calculations
  const totalPaidTips = session.dealerDowns
    .filter((d) => d.tipsPaid)
    .reduce((sum, d) => sum + d.tips, 0);

  // House profit = Total Rake - Expenses
  // Rake is now entered as a lump sum at the end of the night
  const netProfit = totalRake - totalExpenses;

  // Till balance = Physical cash in the till
  // Cash buy-ins add money (money IN)
  // Cash cashouts remove money (paying players OUT)
  // Paid tips remove money (paying dealers OUT from player buy-ins)
  // Expenses remove money (paying for costs OUT)
  // PAID credit buy-ins add money ONLY if manually paid (player paid their debt in cash, money IN)
  // Auto-settled credit does NOT add to till (just wipes the debt, no cash changes hands)
  // Unpaid credit transactions don't affect till (no physical cash movement)
  const cashBuyIns = session.playerTransactions
    .filter((t) => t.type === "buy-in" && t.paymentMethod === "cash")
    .reduce((sum, t) => sum + t.amount, 0);
  const cashCashouts = session.playerTransactions
    .filter((t) => t.type === "cashout" && t.paymentMethod === "cash")
    .reduce((sum, t) => {
      // Check if this is an auto-settled cashout - use actual payout amount
      // Supports formats:
      // - Old: "cash paid: $X)"
      // - New: "received $X cash"
      if (t.notes) {
        // Try new format first
        const newMatch = t.notes.match(/received \$(\d+(?:\.\d{2})?) cash/);
        if (newMatch) {
          return sum + parseFloat(newMatch[1]);
        }
        // Try old format
        const oldMatch = t.notes.match(/cash paid: \$(\d+(?:\.\d{2})?)\)/);
        if (oldMatch) {
          return sum + parseFloat(oldMatch[1]);
        }
      }
      return sum + t.amount;
    }, 0);

  // Calculate auto-settled credit from cashout notes
  // These should NOT be added to the till
  // Supports formats: "credit settled: $X", "paid $X toward credit", "paid $X credit"
  const autoSettledCredit = session.playerTransactions
    .filter((t) => t.type === "cashout" && (t.notes?.includes("credit settled:") || t.notes?.includes("paid $")))
    .reduce((sum, t) => {
      // Try old format: "credit settled: $400.00"
      const oldMatch = t.notes?.match(/credit settled: \$(\d+(?:\.\d{2})?)/);
      if (oldMatch) {
        return sum + parseFloat(oldMatch[1]);
      }
      // Try new simple format: "paid $400.00 credit"
      const newMatch = t.notes?.match(/paid \$(\d+(?:\.\d{2})?) credit/);
      return sum + (newMatch ? parseFloat(newMatch[1]) : 0);
    }, 0);

  // PAID credit buy-ins = player paid their credit debt
  // But we need to subtract auto-settled credit since that doesn't add actual cash
  const paidCreditBuyIns = session.playerTransactions
    .filter((t) => t.type === "buy-in" && t.paymentMethod === "credit" && t.isPaid === true)
    .reduce((sum, t) => sum + t.amount, 0);

  // Only manually paid credit adds to till (not auto-settled)
  const manuallyPaidCredit = Math.max(0, paidCreditBuyIns - autoSettledCredit);

  const tillBalance = cashBuyIns + manuallyPaidCredit - cashCashouts - totalPaidTips - totalExpenses;

  // Calculate total credit balance
  // Credit balance = unpaid credit buy-ins minus any cash that was taken out when they cashed out
  // When a player buys in $500 on credit and cashes out $300, they still owe $200
  // The $200 is the net of their credit transactions: $500 buy-in - $300 cashout = $200
  // We need to calculate per-player credit balances and sum them up
  const playerCreditMap = new Map<string, { buyIns: number; cashouts: number }>();

  session.playerTransactions.forEach((t) => {
    // Only track credit transactions that are unpaid
    if (t.paymentMethod === "credit") {
      const existing = playerCreditMap.get(t.playerName) || { buyIns: 0, cashouts: 0 };
      if (t.type === "buy-in" && !t.isPaid) {
        existing.buyIns += t.amount;
      } else if (t.type === "cashout") {
        // Cashouts reduce what they owe (they're returning chips)
        existing.cashouts += t.amount;
      }
      playerCreditMap.set(t.playerName, existing);
    }
  });

  // Sum up the net credit owed by each player (buy-ins - cashouts, but never negative)
  let creditBalance = 0;
  playerCreditMap.forEach(({ buyIns, cashouts }) => {
    const netOwed = Math.max(0, buyIns - cashouts);
    creditBalance += netOwed;
  });

  // Count unique players
  const uniquePlayers = new Set(session.playerTransactions.map((t) => t.playerName));
  const playerCount = uniquePlayers.size;

  console.log(`🎮 [Game] Summary calculated - Net profit: $${netProfit.toFixed(2)}, Till balance: $${tillBalance.toFixed(2)} (cash: $${cashBuyIns}, manually paid credit: $${manuallyPaidCredit}, auto-settled: $${autoSettledCredit}, cashouts: $${cashCashouts}), Credit balance: $${creditBalance.toFixed(2)}`);

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
    creditBalance,
  } satisfies GameSummary);
});

export { gameRouter };
