import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  addPlayerTransactionRequestSchema,
  type AddPlayerTransactionResponse,
  type GetPlayerTransactionsResponse,
} from "@/shared/contracts";
import { type AppType } from "../types";
import { db } from "../db";

const playersRouter = new Hono<AppType>();

// ============================================
// POST /api/players/transaction - Add player transaction
// ============================================
playersRouter.post(
  "/transaction",
  zValidator("json", addPlayerTransactionRequestSchema),
  async (c) => {
    const data = c.req.valid("json");
    console.log(`💰 [Players] Adding ${data.type} for ${data.playerName}: $${data.amount}`);

    const transaction = await db.playerTransaction.create({
      data: {
        playerName: data.playerName,
        type: data.type,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.notes ?? null,
        gameSessionId: data.gameSessionId,
      },
    });

    console.log(`💰 [Players] Transaction created: ${transaction.id}`);

    return c.json({
      transaction: {
        ...transaction,
        timestamp: transaction.timestamp.toISOString(),
      },
    } satisfies AddPlayerTransactionResponse);
  },
);

// ============================================
// GET /api/players/transactions/:sessionId - Get all player transactions
// ============================================
playersRouter.get("/transactions/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  console.log(`💰 [Players] Getting transactions for session: ${sessionId}`);

  const transactions = await db.playerTransaction.findMany({
    where: { gameSessionId: sessionId },
    orderBy: { timestamp: "desc" },
  });

  console.log(`💰 [Players] Found ${transactions.length} transactions`);

  return c.json({
    transactions: transactions.map((t) => ({
      ...t,
      timestamp: t.timestamp.toISOString(),
    })),
  } satisfies GetPlayerTransactionsResponse);
});

// ============================================
// DELETE /api/players/transaction/:id - Delete a transaction
// ============================================
playersRouter.delete("/transaction/:id", async (c) => {
  const id = c.req.param("id");
  console.log(`💰 [Players] Deleting transaction: ${id}`);

  await db.playerTransaction.delete({
    where: { id },
  });

  console.log(`💰 [Players] Transaction deleted: ${id}`);

  return c.json({ success: true });
});

export { playersRouter };
