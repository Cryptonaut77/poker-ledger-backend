import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  addDealerDownRequestSchema,
  updateDealerDownRequestSchema,
  claimTipsByDealerRequestSchema,
  claimAllRakeRequestSchema,
  updateTotalRakeRequestSchema,
  type AddDealerDownResponse,
  type GetDealerDownsResponse,
  type UpdateDealerDownResponse,
  type MarkDealerTipsPaidResponse,
  type ClaimTipsByDealerResponse,
  type ClaimAllRakeResponse,
  type UpdateTotalRakeResponse,
} from "@/shared/contracts";
import { type AppType } from "../types";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";

const dealersRouter = new Hono<AppType>();

// Apply auth middleware to all dealer routes
dealersRouter.use("*", requireAuth);

// ============================================
// POST /api/dealers/down - Add dealer down
// ============================================
dealersRouter.post("/down", zValidator("json", addDealerDownRequestSchema), async (c) => {
  try {
    const user = c.get("user")!;
    const data = c.req.valid("json");
    console.log(`🎲 [Dealers] Adding down for ${data.dealerName}: Tips $${data.tips}, Rake $${data.rake}, Session: ${data.gameSessionId} (user: ${user.email}, userId: ${user.id})`);

    // First, check if the session exists at all (for debugging)
    const sessionExists = await db.gameSession.findUnique({
      where: { id: data.gameSessionId },
      select: { id: true, userId: true, isActive: true },
    });

    if (sessionExists) {
      console.log(`🎲 [Dealers] Session owner: ${sessionExists.userId}, current user: ${user.id}, match: ${sessionExists.userId === user.id}`);
    }

    // Verify game session exists and user has access (owner or member)
    const gameSession = await db.gameSession.findFirst({
      where: {
        id: data.gameSessionId,
        OR: [
          { userId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
    });

    if (!gameSession) {
      console.error(`🎲 [Dealers] Game session not found or no access: ${data.gameSessionId}`);
      return c.json({ error: "Game session not found" }, 404);
    }

    if (!gameSession.isActive) {
      console.error(`🎲 [Dealers] Game session is not active: ${data.gameSessionId}`);
      return c.json({ error: "Game session is not active" }, 400);
    }

    // Get user initials (from user record or generate from name)
    const initials = (user as any).initials || (user.name ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : user.email.slice(0, 2).toUpperCase());

    const dealerDown = await db.dealerDown.create({
      data: {
        dealerName: data.dealerName,
        tips: data.tips,
        rake: data.rake,
        gameSessionId: data.gameSessionId,
        createdById: user.id,
        createdByInitials: initials,
      },
    });

    console.log(`🎲 [Dealers] Dealer down created: ${dealerDown.id} by ${initials}`);

    return c.json({
      dealerDown: {
        ...dealerDown,
        timestamp: dealerDown.timestamp.toISOString(),
      },
    } satisfies AddDealerDownResponse);
  } catch (error: any) {
    console.error("🎲 [Dealers] Error adding dealer down:", error);
    return c.json({ error: error.message || "Failed to add dealer down" }, 500);
  }
});

// ============================================
// GET /api/dealers/downs/:sessionId - Get all dealer downs
// ============================================
dealersRouter.get("/downs/:sessionId", async (c) => {
  const user = c.get("user")!;
  const sessionId = c.req.param("sessionId");
  console.log(`🎲 [Dealers] Getting downs for session: ${sessionId} (user: ${user.email})`);

  // Verify user has access (owner or member)
  const gameSession = await db.gameSession.findFirst({
    where: {
      id: sessionId,
      OR: [
        { userId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    },
  });

  if (!gameSession) {
    return c.json({ error: "Game session not found" }, 404);
  }

  const downs = await db.dealerDown.findMany({
    where: { gameSessionId: sessionId },
    orderBy: { timestamp: "desc" },
  });

  console.log(`🎲 [Dealers] Found ${downs.length} dealer downs`);

  return c.json({
    downs: downs.map((d) => ({
      ...d,
      timestamp: d.timestamp.toISOString(),
    })),
  } satisfies GetDealerDownsResponse);
});

// ============================================
// DELETE /api/dealers/down/:id - Delete a dealer down
// ============================================
dealersRouter.delete("/down/:id", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  console.log(`🎲 [Dealers] Deleting dealer down: ${id} (user: ${user.email})`);

  // Verify the dealer down belongs to a session owned by this user
  const dealerDown = await db.dealerDown.findUnique({
    where: { id },
    include: { gameSession: true },
  });

  if (!dealerDown || dealerDown.gameSession.userId !== user.id) {
    return c.json({ error: "Dealer down not found" }, 404);
  }

  await db.dealerDown.delete({
    where: { id },
  });

  console.log(`🎲 [Dealers] Dealer down deleted: ${id}`);

  return c.json({ success: true });
});

// ============================================
// PUT /api/dealers/down/:id - Update dealer down
// ============================================
dealersRouter.put("/down/:id", zValidator("json", updateDealerDownRequestSchema), async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const data = c.req.valid("json");
  console.log(`🎲 [Dealers] Updating dealer down: ${id} (user: ${user.email})`);

  // Verify the dealer down belongs to a session owned by this user
  const existingDown = await db.dealerDown.findUnique({
    where: { id },
    include: { gameSession: true },
  });

  if (!existingDown || existingDown.gameSession.userId !== user.id) {
    return c.json({ error: "Dealer down not found" }, 404);
  }

  const dealerDown = await db.dealerDown.update({
    where: { id },
    data: {
      dealerName: data.dealerName,
      tips: data.tips,
      rake: data.rake,
    },
  });

  console.log(`🎲 [Dealers] Dealer down updated: ${id}`);

  return c.json({
    dealerDown: {
      ...dealerDown,
      timestamp: dealerDown.timestamp.toISOString(),
    },
  } satisfies UpdateDealerDownResponse);
});

// ============================================
// PUT /api/dealers/down/:id/pay - Mark dealer tips as paid
// ============================================
dealersRouter.put("/down/:id/pay", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  console.log(`🎲 [Dealers] Marking tips as paid for dealer down: ${id} (user: ${user.email})`);

  // Verify the dealer down belongs to a session owned by this user
  const existingDown = await db.dealerDown.findUnique({
    where: { id },
    include: { gameSession: true },
  });

  if (!existingDown || existingDown.gameSession.userId !== user.id) {
    return c.json({ error: "Dealer down not found" }, 404);
  }

  const dealerDown = await db.dealerDown.update({
    where: { id },
    data: { tipsPaid: true },
  });

  console.log(`🎲 [Dealers] Tips marked as paid: ${id}`);

  return c.json({
    dealerDown: {
      ...dealerDown,
      timestamp: dealerDown.timestamp.toISOString(),
    },
  } satisfies MarkDealerTipsPaidResponse);
});

// ============================================
// PUT /api/dealers/down/:id/unpay - Mark dealer tips as unpaid
// ============================================
dealersRouter.put("/down/:id/unpay", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  console.log(`🎲 [Dealers] Marking tips as unpaid for dealer down: ${id} (user: ${user.email})`);

  // Verify the dealer down belongs to a session owned by this user
  const existingDown = await db.dealerDown.findUnique({
    where: { id },
    include: { gameSession: true },
  });

  if (!existingDown || existingDown.gameSession.userId !== user.id) {
    return c.json({ error: "Dealer down not found" }, 404);
  }

  const dealerDown = await db.dealerDown.update({
    where: { id },
    data: { tipsPaid: false },
  });

  console.log(`🎲 [Dealers] Tips marked as unpaid: ${id}`);

  return c.json({
    dealerDown: {
      ...dealerDown,
      timestamp: dealerDown.timestamp.toISOString(),
    },
  } satisfies MarkDealerTipsPaidResponse);
});

// ============================================
// PUT /api/dealers/down/:id/claim-rake - Mark rake as claimed
// ============================================
dealersRouter.put("/down/:id/claim-rake", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  console.log(`🎲 [Dealers] Marking rake as claimed for dealer down: ${id} (user: ${user.email})`);

  // Verify the dealer down belongs to a session owned by this user
  const existingDown = await db.dealerDown.findUnique({
    where: { id },
    include: { gameSession: true },
  });

  if (!existingDown || existingDown.gameSession.userId !== user.id) {
    return c.json({ error: "Dealer down not found" }, 404);
  }

  const dealerDown = await db.dealerDown.update({
    where: { id },
    data: { rakeClaimed: true },
  });

  console.log(`🎲 [Dealers] Rake marked as claimed: ${id}`);

  return c.json({
    dealerDown: {
      ...dealerDown,
      timestamp: dealerDown.timestamp.toISOString(),
    },
  } satisfies MarkDealerTipsPaidResponse);
});

// ============================================
// PUT /api/dealers/down/:id/unclaim-rake - Mark rake as unclaimed
// ============================================
dealersRouter.put("/down/:id/unclaim-rake", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  console.log(`🎲 [Dealers] Marking rake as unclaimed for dealer down: ${id} (user: ${user.email})`);

  // Verify the dealer down belongs to a session owned by this user
  const existingDown = await db.dealerDown.findUnique({
    where: { id },
    include: { gameSession: true },
  });

  if (!existingDown || existingDown.gameSession.userId !== user.id) {
    return c.json({ error: "Dealer down not found" }, 404);
  }

  const dealerDown = await db.dealerDown.update({
    where: { id },
    data: { rakeClaimed: false },
  });

  console.log(`🎲 [Dealers] Rake marked as unclaimed: ${id}`);

  return c.json({
    dealerDown: {
      ...dealerDown,
      timestamp: dealerDown.timestamp.toISOString(),
    },
  } satisfies MarkDealerTipsPaidResponse);
});

// ============================================
// POST /api/dealers/claim-tips-by-dealer - Claim all tips for a specific dealer with percentage
// ============================================
dealersRouter.post("/claim-tips-by-dealer", zValidator("json", claimTipsByDealerRequestSchema), async (c) => {
  try {
    const user = c.get("user")!;
    const data = c.req.valid("json");
    const percentage = data.percentage ?? 100;

    console.log(`🎲 [Dealers] Claiming ${percentage}% tips for dealer: ${data.dealerName} (user: ${user.email}, userId: ${user.id})`);

    // First, check if the session exists at all (for debugging)
    const sessionExists = await db.gameSession.findUnique({
      where: { id: data.gameSessionId },
      select: { id: true, userId: true, isActive: true },
    });

    if (!sessionExists) {
      console.error(`🎲 [Dealers] Game session does not exist: ${data.gameSessionId}`);
      return c.json({ error: "Game session does not exist. It may have been deleted." }, 404);
    }

    console.log(`🎲 [Dealers] Session exists - owner: ${sessionExists.userId}, current user: ${user.id}, isActive: ${sessionExists.isActive}`);

    // Verify game session exists and user is owner
    const gameSession = await db.gameSession.findFirst({
      where: {
        id: data.gameSessionId,
        userId: user.id,
      },
    });

    if (!gameSession) {
      console.error(`🎲 [Dealers] User ${user.id} (${user.email}) does not have access to session ${data.gameSessionId} owned by ${sessionExists.userId}`);
      return c.json({ error: "You don't have access to this game session. You may be logged in with a different account." }, 403);
    }

    // Get all unpaid tips for this dealer in this session
    const unpaidDowns = await db.dealerDown.findMany({
      where: {
        gameSessionId: data.gameSessionId,
        dealerName: data.dealerName,
        tipsPaid: false,
      },
    });

    if (unpaidDowns.length === 0) {
      return c.json({
        updatedCount: 0,
        totalTipsClaimed: 0,
        ownerCut: 0,
        dealerPayout: 0,
      } satisfies ClaimTipsByDealerResponse);
    }

    // Calculate totals
    const totalTips = unpaidDowns.reduce((sum, d) => sum + d.tips, 0);
    const dealerPayout = (totalTips * percentage) / 100;
    const ownerCut = totalTips - dealerPayout;

    // Calculate owner cut per down (proportional to tips)
    // Mark all as paid and store owner cut for each down
    await Promise.all(
      unpaidDowns.map((down) => {
        const downOwnerCut = totalTips > 0 ? (down.tips / totalTips) * ownerCut : 0;
        return db.dealerDown.update({
          where: { id: down.id },
          data: {
            tipsPaid: true,
            ownerCut: downOwnerCut,
          },
        });
      })
    );

    console.log(`🎲 [Dealers] Claimed tips for ${data.dealerName}: ${unpaidDowns.length} downs, $${totalTips} total, $${dealerPayout} to dealer, $${ownerCut} to owner (stored)`);

    return c.json({
      updatedCount: unpaidDowns.length,
      totalTipsClaimed: totalTips,
      ownerCut: ownerCut,
      dealerPayout: dealerPayout,
    } satisfies ClaimTipsByDealerResponse);
  } catch (error: any) {
    console.error("🎲 [Dealers] Error claiming tips by dealer:", error);
    return c.json({ error: error.message || "Failed to claim tips" }, 500);
  }
});

// ============================================
// POST /api/dealers/claim-all-rake - Claim all rake from all dealers
// ============================================
dealersRouter.post("/claim-all-rake", zValidator("json", claimAllRakeRequestSchema), async (c) => {
  try {
    const user = c.get("user")!;
    const data = c.req.valid("json");

    console.log(`🎲 [Dealers] Claiming all rake for session: ${data.gameSessionId} (user: ${user.email}, userId: ${user.id})`);

    // First, check if the session exists at all (for debugging)
    const sessionExists = await db.gameSession.findUnique({
      where: { id: data.gameSessionId },
      select: { id: true, userId: true, isActive: true },
    });

    if (!sessionExists) {
      console.error(`🎲 [Dealers] Game session does not exist: ${data.gameSessionId}`);
      return c.json({ error: "Game session does not exist. It may have been deleted." }, 404);
    }

    console.log(`🎲 [Dealers] Session exists - owner: ${sessionExists.userId}, current user: ${user.id}, isActive: ${sessionExists.isActive}`);

    // Verify game session exists and user is owner
    const gameSession = await db.gameSession.findFirst({
      where: {
        id: data.gameSessionId,
        userId: user.id,
      },
    });

    if (!gameSession) {
      console.error(`🎲 [Dealers] User ${user.id} (${user.email}) does not have access to session ${data.gameSessionId} owned by ${sessionExists.userId}`);
      return c.json({ error: "You don't have access to this game session. You may be logged in with a different account." }, 403);
    }

    // Get all unclaimed rake for this session
    const unclaimedDowns = await db.dealerDown.findMany({
      where: {
        gameSessionId: data.gameSessionId,
        rakeClaimed: false,
      },
    });

    console.log(`🎲 [Dealers] Found ${unclaimedDowns.length} unclaimed downs for session ${data.gameSessionId}`);
    unclaimedDowns.forEach((d, i) => {
      console.log(`🎲 [Dealers]   Down ${i + 1}: id=${d.id}, dealer=${d.dealerName}, rake=$${d.rake}, rakeClaimed=${d.rakeClaimed}`);
    });

    if (unclaimedDowns.length === 0) {
      console.log(`🎲 [Dealers] No unclaimed rake to claim, returning 0`);
      return c.json({
        updatedCount: 0,
        totalRakeClaimed: 0,
      } satisfies ClaimAllRakeResponse);
    }

    // Calculate total rake
    const totalRake = unclaimedDowns.reduce((sum, d) => sum + d.rake, 0);
    console.log(`🎲 [Dealers] Total rake to claim: $${totalRake}`);

    // Mark all as claimed
    const updateResult = await db.dealerDown.updateMany({
      where: {
        gameSessionId: data.gameSessionId,
        rakeClaimed: false,
      },
      data: { rakeClaimed: true },
    });

    console.log(`🎲 [Dealers] Update result: ${updateResult.count} rows updated`);

    // Verify the update worked
    const verifyDowns = await db.dealerDown.findMany({
      where: {
        gameSessionId: data.gameSessionId,
      },
      select: { id: true, rake: true, rakeClaimed: true },
    });
    console.log(`🎲 [Dealers] After update verification:`);
    verifyDowns.forEach((d, i) => {
      console.log(`🎲 [Dealers]   Down ${i + 1}: id=${d.id}, rake=$${d.rake}, rakeClaimed=${d.rakeClaimed}`);
    });

    console.log(`🎲 [Dealers] Claimed all rake: ${updateResult.count} downs, $${totalRake} total`);
    console.log(`🎲 [Dealers] ========== RAKE CLAIM COMPLETE ==========`);
    console.log(`🎲 [Dealers] Session ${data.gameSessionId}: All rake marked as claimed`);
    console.log(`🎲 [Dealers] This amount ($${totalRake}) should now be subtracted from till balance`);

    return c.json({
      updatedCount: updateResult.count,
      totalRakeClaimed: totalRake,
    } satisfies ClaimAllRakeResponse);
  } catch (error: any) {
    console.error("🎲 [Dealers] Error claiming all rake:", error);
    return c.json({ error: error.message || "Failed to claim rake" }, 500);
  }
});

// ============================================
// PUT /api/dealers/total-rake - Update total rake for session
// ============================================
dealersRouter.put("/total-rake", zValidator("json", updateTotalRakeRequestSchema), async (c) => {
  try {
    const user = c.get("user")!;
    const data = c.req.valid("json");
    console.log(`🎲 [Dealers] Updating total rake for session: ${data.gameSessionId}, amount: $${data.totalRake} (user: ${user.email}, userId: ${user.id})`);

    // First, check if the session exists at all (for debugging)
    const sessionExists = await db.gameSession.findUnique({
      where: { id: data.gameSessionId },
      select: { id: true, userId: true, isActive: true },
    });

    if (!sessionExists) {
      console.error(`🎲 [Dealers] Game session does not exist: ${data.gameSessionId}`);
      return c.json({ error: "Game session does not exist. It may have been deleted." }, 404);
    }

    console.log(`🎲 [Dealers] Session exists - owner: ${sessionExists.userId}, current user: ${user.id}, isActive: ${sessionExists.isActive}`);

    // Verify game session exists and user has access
    const gameSession = await db.gameSession.findFirst({
      where: {
        id: data.gameSessionId,
        OR: [
          { userId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
    });

    if (!gameSession) {
      console.error(`🎲 [Dealers] User ${user.id} (${user.email}) does not have access to session ${data.gameSessionId} owned by ${sessionExists.userId}`);
      return c.json({ error: "You don't have access to this game session. You may be logged in with a different account." }, 403);
    }

    if (!gameSession.isActive) {
      console.error(`🎲 [Dealers] Game session is not active: ${data.gameSessionId}`);
      return c.json({ error: "Game session is not active" }, 400);
    }

    // Update total rake
    const updatedSession = await db.gameSession.update({
      where: { id: data.gameSessionId },
      data: { totalRake: data.totalRake },
    });

    console.log(`🎲 [Dealers] Total rake updated: $${data.totalRake}`);

    return c.json({
      session: {
        ...updatedSession,
        startedAt: updatedSession.startedAt.toISOString(),
        endedAt: updatedSession.endedAt?.toISOString() || null,
        createdAt: updatedSession.createdAt.toISOString(),
        updatedAt: updatedSession.updatedAt.toISOString(),
      },
      totalRake: updatedSession.totalRake,
    } satisfies UpdateTotalRakeResponse);
  } catch (error: any) {
    console.error("🎲 [Dealers] Error updating total rake:", error);
    return c.json({ error: error.message || "Failed to update total rake" }, 500);
  }
});

export { dealersRouter };
