import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  addDealerDownRequestSchema,
  type AddDealerDownResponse,
  type GetDealerDownsResponse,
} from "@/shared/contracts";
import { type AppType } from "../types";
import { db } from "../db";

const dealersRouter = new Hono<AppType>();

// ============================================
// POST /api/dealers/down - Add dealer down
// ============================================
dealersRouter.post("/down", zValidator("json", addDealerDownRequestSchema), async (c) => {
  const data = c.req.valid("json");
  console.log(`🎲 [Dealers] Adding down for ${data.dealerName}: Tips $${data.tips}, Rake $${data.rake}`);

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
});

// ============================================
// GET /api/dealers/downs/:sessionId - Get all dealer downs
// ============================================
dealersRouter.get("/downs/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  console.log(`🎲 [Dealers] Getting downs for session: ${sessionId}`);

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
  const id = c.req.param("id");
  console.log(`🎲 [Dealers] Deleting dealer down: ${id}`);

  await db.dealerDown.delete({
    where: { id },
  });

  console.log(`🎲 [Dealers] Dealer down deleted: ${id}`);

  return c.json({ success: true });
});

export { dealersRouter };
