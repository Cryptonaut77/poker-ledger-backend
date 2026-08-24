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
    const ownedGame = await db.gameSession.findFirst({
      where: { isActive: true, userId: user.id },
      orderBy: { startedAt: "desc" },
      include: {
        _count: {
          select: {
            playerTransactions: true,
            dealerDowns: true,
            expenses: true,
          },
        },
      },
    });

    // Check if user is a member of an active game
    const membership = await db.gameSessionMember.findFirst({
      where: { userId: user.id, gameSession: { isActive: true } },
      include: { gameSession: true },
    });

    let session: Awaited<ReturnType<typeof db.gameSession.findFirst>> = null;

    // If user owns an empty game but is also a member of a shared game,
    // prefer the shared game (deactivate the empty one)
    if (ownedGame && membership?.gameSession) {
      const hasData =
        ownedGame._count.playerTransactions > 0 ||
        ownedGame._count.dealerDowns > 0 ||
        ownedGame._count.expenses > 0;

      if (!hasData) {
        console.log(`🎮 [Game] User ${user.email} has empty owned game ${ownedGame.id} but is member of ${membership.gameSession.id} - preferring shared game`);
        await db.gameSession.update({
          where: { id: ownedGame.id },
          data: { isActive: false },
        });
        session = membership.gameSession;
      } else {
        session = ownedGame;
      }
    } else if (ownedGame) {
      session = ownedGame;
    } else if (membership?.gameSession) {
      session = membership.gameSession;
    }

    // Get fresh user data to check game counts
    const currentUser = await db.user.findUnique({
      where: { id: user.id },
      select: { completedGames: true, totalGamesCreated: true },
    });

    console.log(`🎮 [Game] User ${user.email} has completed ${currentUser?.completedGames ?? 0} games, total created: ${currentUser?.totalGamesCreated ?? 0}`);

    // Backfill totalGamesCreated for existing users who have games but the new counter is 0
    if ((currentUser?.totalGamesCreated ?? 0) === 0 && (currentUser?.completedGames ?? 0) > 0) {
      const totalSessions = await db.gameSession.count({ where: { userId: user.id } });
      if (totalSessions > 0) {
        await db.user.update({
          where: { id: user.id },
          data: { totalGamesCreated: totalSessions },
        });
        console.log(`🎮 [Game] Backfilled totalGamesCreated to ${totalSessions} for user ${user.email}`);
      }
    }

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

      // Increment totalGamesCreated
      await db.user.update({
        where: { id: user.id },
        data: { totalGamesCreated: { increment: 1 } },
      });

      console.log(`🎮 [Game] Created new session: ${session.id} with owner userId: ${session.userId}`);
    } else {
      console.log(`🎮 [Game] Found active session: ${session.id}, owner userId: ${session.userId}, current userId: ${user.id}`);
    }

    // Re-fetch user to get updated totalGamesCreated
    const updatedUser = await db.user.findUnique({
      where: { id: user.id },
      select: { completedGames: true, totalGamesCreated: true },
    });

    return c.json({
      session: {
        ...session,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt?.toISOString() ?? null,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
      userCompletedGames: updatedUser?.completedGames ?? 0,
      userTotalGamesCreated: updatedUser?.totalGamesCreated ?? 0,
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
      currency: session.currency,
      language: session.language,
      totalRake: session.totalRake,
      playerTransactions: session.playerTransactions.map((t) => ({
        id: t.id,
        playerName: t.playerName,
        type: t.type as "buy-in" | "cashout",
        amount: t.amount,
        paymentMethod: t.paymentMethod as "cash" | "electronic" | "credit",
        notes: t.notes,
        isPaid: t.isPaid,
        timestamp: t.timestamp.toISOString(),
        gameSessionId: t.gameSessionId,
      })),
      dealerDowns: session.dealerDowns.map((d) => ({
        id: d.id,
        dealerName: d.dealerName,
        tips: d.tips,
        rake: d.rake,
        tipsPaid: d.tipsPaid,
        rakeClaimed: d.rakeClaimed,
        timestamp: d.timestamp.toISOString(),
        gameSessionId: d.gameSessionId,
        createdByInitials: d.createdByInitials,
      })),
      expenses: session.expenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        category: e.category as "food" | "drinks" | "other",
        paymentMethod: e.paymentMethod as "cash" | "electronic",
        paidOut: e.paidOut,
        notes: e.notes,
        timestamp: e.timestamp.toISOString(),
        gameSessionId: e.gameSessionId,
        createdByInitials: e.createdByInitials,
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
  const activeCount = await db.gameSession.count({
    where: { isActive: true, userId: user.id },
  });

  await db.gameSession.updateMany({
    where: { isActive: true, userId: user.id },
    data: {
      isActive: false,
      endedAt: new Date(),
    },
  });

  // Increment completed games counter for each ended session, and totalGamesCreated for the new one
  if (activeCount > 0) {
    await db.user.update({
      where: { id: user.id },
      data: {
        completedGames: { increment: activeCount },
        totalGamesCreated: { increment: 1 },
      },
    });
  } else {
    await db.user.update({
      where: { id: user.id },
      data: {
        totalGamesCreated: { increment: 1 },
      },
    });
  }

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

  // Only count claimed rake for calculations
  const totalClaimedRake = session.dealerDowns
    .filter((d) => d.rakeClaimed)
    .reduce((sum, d) => sum + d.rake, 0);

  // Sum up owner cut from tips (house's share when paying dealers less than 100%)
  const totalOwnerCut = session.dealerDowns
    .filter((d) => d.tipsPaid)
    .reduce((sum, d) => sum + (d.ownerCut ?? 0), 0);

  console.log(`🎮 [Game] Summary calculation - Dealer downs:`, session.dealerDowns.map(d => ({
    id: d.id,
    dealer: d.dealerName,
    tips: d.tips,
    rake: d.rake,
    tipsPaid: d.tipsPaid,
    rakeClaimed: d.rakeClaimed,
    ownerCut: d.ownerCut ?? 0,
  })));
  console.log(`🎮 [Game] totalPaidTips: $${totalPaidTips}, totalClaimedRake: $${totalClaimedRake}, totalOwnerCut: $${totalOwnerCut}`);

  // House profit = Claimed Rake + Owner Cut from Tips - Expenses
  // Claimed rake and owner cut (house share of tips) count as realized profit
  const netProfit = totalClaimedRake + totalOwnerCut - totalExpenses;

  // Till balance = Physical cash in the till
  // Cash buy-ins add money (money IN)
  // Cash cashouts remove money (paying players OUT)
  // Paid tips remove money (paying dealers OUT - tips collected from pots go into till, then paid out)
  // Claimed rake removes money (rake collected from pots goes into till, then taken as house profit)
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
        if (newMatch?.[1]) {
          return sum + parseFloat(newMatch[1]);
        }
        // Try old format
        const oldMatch = t.notes.match(/cash paid: \$(\d+(?:\.\d{2})?)\)/);
        if (oldMatch?.[1]) {
          return sum + parseFloat(oldMatch[1]);
        }
      }
      return sum + t.amount;
    }, 0);

  // Per-player credit ledger: pair credit buy-ins with credit cashouts to figure
  // out which paid credit buy-ins were settled by chip-return (no cash moved) vs
  // settled by actual cash payment (cash entered the till).
  //
  // Rule: if a player has paid credit buy-ins and credit cashouts, the cashouts
  // absorbed the buy-ins as chip-return first. Only the excess paid buy-ins
  // beyond total credit cashouts represent real cash repayment.
  //
  // Cash/electronic cashouts can also settle credit via chip-return when the
  // auto-settle flow ran. Those are stored with paymentMethod=cash/electronic
  // and a "paid $X credit" prefix in notes; the X is chip-return that absorbed
  // buy-ins (no cash moved for that portion). Count it as cashoutTotal so
  // manuallyPaidCredit doesn't double-count buy-ins that were absorbed by chips.
  const playerCreditLedger = new Map<string, {
    buyInPaid: number;
    buyInUnpaid: number;
    cashoutTotal: number;
    cashoutUnpaid: number;
  }>();
  const getLedger = (playerName: string) =>
    playerCreditLedger.get(playerName) ?? {
      buyInPaid: 0, buyInUnpaid: 0, cashoutTotal: 0, cashoutUnpaid: 0,
    };
  session.playerTransactions.forEach((t) => {
    if (t.paymentMethod === "credit") {
      const ledger = getLedger(t.playerName);
      if (t.type === "buy-in") {
        if (t.isPaid) ledger.buyInPaid += t.amount;
        else ledger.buyInUnpaid += t.amount;
      } else if (t.type === "cashout") {
        ledger.cashoutTotal += t.amount;
        if (!t.isPaid) ledger.cashoutUnpaid += t.amount;
      }
      playerCreditLedger.set(t.playerName, ledger);
    } else if (t.type === "cashout" && t.notes) {
      const match = t.notes.match(/paid \$(\d+(?:\.\d{2})?) credit/);
      const settledCredit = match?.[1] ? parseFloat(match[1]) : 0;
      if (settledCredit > 0) {
        const ledger = getLedger(t.playerName);
        ledger.cashoutTotal += settledCredit;
        playerCreditLedger.set(t.playerName, ledger);
      }
    }
  });

  let manuallyPaidCredit = 0;
  let paidIouCashouts = 0;
  playerCreditLedger.forEach(({ buyInPaid, buyInUnpaid, cashoutTotal, cashoutUnpaid }) => {
    // Cash repayment = paid buy-ins that weren't absorbed by chip-return cashouts
    manuallyPaidCredit += Math.max(0, buyInPaid - cashoutTotal);
    // Paid IOU cashouts that represent actual cash leaving the till:
    // total buy-ins absorb cashouts as chip-return; unpaid cashouts absorb first
    // (they're still on the books), then paid cashouts absorb the rest. Whatever
    // paid cashout amount is left over is real cash the house paid out.
    const cashoutPaid = cashoutTotal - cashoutUnpaid;
    const totalBuyIn = buyInPaid + buyInUnpaid;
    const buyInAbsorbedByPaid = Math.min(cashoutPaid, Math.max(0, totalBuyIn - cashoutUnpaid));
    paidIouCashouts += cashoutPaid - buyInAbsorbedByPaid;
  });

  // Full tips paid leaves the till: dealer gets their share, house pockets owner cut
  // Both amounts physically leave the till when tips are paid out
  const actualDealerPayout = totalPaidTips;

  // Till balance: what's physically left in the cash box
  // Full tips paid out (dealer share + owner cut both leave till), plus claimed rake and expenses
  const tillBalance = cashBuyIns + manuallyPaidCredit - cashCashouts - paidIouCashouts - actualDealerPayout - totalClaimedRake - totalExpenses;

  // Per-player net credit position. Negative net = house owes player (IOU);
  // positive net = player owes house (credit). Counts all credit buy-ins (paid
  // or not) and credit cashouts so chip-return settlement nets out cleanly.
  let creditBalance = 0; // player -> house
  let iouBalance = 0;    // house -> player
  playerCreditLedger.forEach(({ buyInPaid, buyInUnpaid, cashoutTotal, cashoutUnpaid }) => {
    const totalBuyIn = buyInPaid + buyInUnpaid;
    if (totalBuyIn >= cashoutTotal) {
      // Player either net-owes house or is even; only unpaid buy-ins remain as debt
      creditBalance += buyInUnpaid;
    } else {
      // Cashouts exceed buy-ins — house owes the player the excess (unpaid portion only)
      const excess = cashoutTotal - totalBuyIn;
      iouBalance += Math.min(excess, cashoutUnpaid);
    }
  });

  // Count unique players
  const uniquePlayers = new Set(session.playerTransactions.map((t) => t.playerName));
  const playerCount = uniquePlayers.size;

  console.log(`🎮 [Game] Summary calculated - Net profit: $${netProfit.toFixed(2)} (claimed rake: $${totalClaimedRake}, owner cut: $${totalOwnerCut}), Till balance: $${tillBalance.toFixed(2)} (cash: $${cashBuyIns}, manually paid credit: $${manuallyPaidCredit}, cashouts: $${cashCashouts}, paid IOU cashouts: $${paidIouCashouts}, dealer payout: $${actualDealerPayout}, claimed rake: $${totalClaimedRake}, expenses: $${totalExpenses}), Credit balance: $${creditBalance.toFixed(2)}, IOU balance (house owes): $${iouBalance.toFixed(2)}`);

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
      currency: session.currency,
      language: session.language,
      totalRake: session.totalRake,
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
    iouBalance,
  } satisfies GameSummary);
});

export { gameRouter };
