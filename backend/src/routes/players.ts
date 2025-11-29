import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  addPlayerTransactionRequestSchema,
  updatePlayerTransactionRequestSchema,
  type AddPlayerTransactionResponse,
  type GetPlayerTransactionsResponse,
  type UpdatePlayerTransactionResponse,
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
        id: transaction.id,
        playerName: transaction.playerName,
        type: transaction.type as "buy-in" | "cashout",
        amount: transaction.amount,
        paymentMethod: transaction.paymentMethod as "cash" | "electronic" | "credit",
        notes: transaction.notes,
        timestamp: transaction.timestamp.toISOString(),
        gameSessionId: transaction.gameSessionId,
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
      id: t.id,
      playerName: t.playerName,
      type: t.type as "buy-in" | "cashout",
      amount: t.amount,
      paymentMethod: t.paymentMethod as "cash" | "electronic" | "credit",
      notes: t.notes,
      timestamp: t.timestamp.toISOString(),
      gameSessionId: t.gameSessionId,
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

// ============================================
// PUT /api/players/transaction/:id - Update a transaction
// ============================================
playersRouter.put(
  "/transaction/:id",
  zValidator("json", updatePlayerTransactionRequestSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    console.log(`💰 [Players] Updating transaction: ${id}`);

    const transaction = await db.playerTransaction.update({
      where: { id },
      data: {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.notes ?? null,
      },
    });

    console.log(`💰 [Players] Transaction updated: ${transaction.id}`);

    return c.json({
      transaction: {
        id: transaction.id,
        playerName: transaction.playerName,
        type: transaction.type as "buy-in" | "cashout",
        amount: transaction.amount,
        paymentMethod: transaction.paymentMethod as "cash" | "electronic" | "credit",
        notes: transaction.notes,
        timestamp: transaction.timestamp.toISOString(),
        gameSessionId: transaction.gameSessionId,
      },
    } satisfies UpdatePlayerTransactionResponse);
  },
);

export { playersRouter };
