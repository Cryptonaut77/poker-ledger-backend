import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  addDealerDownRequestSchema,
  updateDealerDownRequestSchema,
  type AddDealerDownResponse,
  type GetDealerDownsResponse,
  type UpdateDealerDownResponse,
  type MarkDealerTipsPaidResponse,
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
    console.log(`🎲 [Dealers] Adding down for ${data.dealerName}: Tips $${data.tips}, Rake $${data.rake}, Session: ${data.gameSessionId} (user: ${user.email})`);

    // Verify game session exists and belongs to this user
    const gameSession = await db.gameSession.findFirst({
      where: { id: data.gameSessionId, userId: user.id },
    });

    if (!gameSession) {
      console.error(`🎲 [Dealers] Game session not found: ${data.gameSessionId}`);
      return c.json({ error: "Game session not found" }, 404);
    }

    if (!gameSession.isActive) {
      console.error(`🎲 [Dealers] Game session is not active: ${data.gameSessionId}`);
      return c.json({ error: "Game session is not active" }, 400);
    }

    const dealerDown = await db.dealerDown.create({
      data: {
        dealerName: data.dealerName,
        tips: data.tips,
        rake: data.rake,
        gameSessionId: data.gameSessionId,
      },
    });

    console.log(`🎲 [Dealers] Dealer down created: ${dealerDown.id}`);

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

  // Verify the game session belongs to this user
  const gameSession = await db.gameSession.findFirst({
    where: { id: sessionId, userId: user.id },
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

export { dealersRouter };
