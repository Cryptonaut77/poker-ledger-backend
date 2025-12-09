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
import { requireAuth } from "../middleware/requireAuth";

const playersRouter = new Hono<AppType>();

// Apply auth middleware to all player routes
playersRouter.use("*", requireAuth);

// ============================================
// POST /api/players/transaction - Add player transaction
// ============================================
playersRouter.post(
  "/transaction",
  zValidator("json", addPlayerTransactionRequestSchema),
  async (c) => {
    const user = c.get("user")!;
    const data = c.req.valid("json");
    console.log(`💰 [Players] Adding ${data.type} for ${data.playerName}: $${data.amount} (user: ${user.email})`);

    // Verify user has access (owner or member)
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
      return c.json({ error: "Game session not found" }, 404);
    }

    // Get user initials
    const initials = user.initials || (user.name ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : user.email.slice(0, 2).toUpperCase());

    const transaction = await db.playerTransaction.create({
      data: {
        playerName: data.playerName,
        type: data.type,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.notes ?? null,
        gameSessionId: data.gameSessionId,
        createdById: user.id,
        createdByInitials: initials,
      },
    });

    console.log(`💰 [Players] Transaction created: ${transaction.id} by ${initials}`);

    return c.json({
      transaction: {
        id: transaction.id,
        playerName: transaction.playerName,
        type: transaction.type as "buy-in" | "cashout",
        amount: transaction.amount,
        paymentMethod: transaction.paymentMethod as "cash" | "electronic" | "credit",
        notes: transaction.notes,
        isPaid: transaction.isPaid,
        timestamp: transaction.timestamp.toISOString(),
        gameSessionId: transaction.gameSessionId,
        createdByInitials: transaction.createdByInitials,
      },
    } satisfies AddPlayerTransactionResponse);
  },
);

// ============================================
// GET /api/players/transactions/:sessionId - Get all player transactions
// ============================================
playersRouter.get("/transactions/:sessionId", async (c) => {
  const user = c.get("user")!;
  const sessionId = c.req.param("sessionId");
  console.log(`💰 [Players] Getting transactions for session: ${sessionId} (user: ${user.email})`);

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
      isPaid: t.isPaid,
      timestamp: t.timestamp.toISOString(),
      gameSessionId: t.gameSessionId,
      createdByInitials: t.createdByInitials,
    })),
  } satisfies GetPlayerTransactionsResponse);
});

// ============================================
// DELETE /api/players/transaction/:id - Delete a transaction
// ============================================
playersRouter.delete("/transaction/:id", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  console.log(`💰 [Players] Deleting transaction: ${id} (user: ${user.email})`);

  // Verify the transaction belongs to a session owned by this user
  const transaction = await db.playerTransaction.findUnique({
    where: { id },
    include: { gameSession: true },
  });

  if (!transaction || transaction.gameSession.userId !== user.id) {
    return c.json({ error: "Transaction not found" }, 404);
  }

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
    const user = c.get("user")!;
    const id = c.req.param("id");
    const data = c.req.valid("json");
    console.log(`💰 [Players] Updating transaction: ${id} (user: ${user.email})`);

    // Verify the transaction belongs to a session owned by this user
    const existingTransaction = await db.playerTransaction.findUnique({
      where: { id },
      include: { gameSession: true },
    });

    if (!existingTransaction || existingTransaction.gameSession.userId !== user.id) {
      return c.json({ error: "Transaction not found" }, 404);
    }

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
        isPaid: transaction.isPaid,
        timestamp: transaction.timestamp.toISOString(),
        gameSessionId: transaction.gameSessionId,
      },
    } satisfies UpdatePlayerTransactionResponse);
  },
);

// ============================================
// PUT /api/players/transaction/:id/mark-paid - Mark a credit transaction as paid
// ============================================
playersRouter.put("/transaction/:id/mark-paid", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  console.log(`💰 [Players] Marking transaction as paid: ${id} (user: ${user.email})`);

  // Verify the transaction belongs to a session owned by this user
  const existingTransaction = await db.playerTransaction.findUnique({
    where: { id },
    include: { gameSession: true },
  });

  if (!existingTransaction || existingTransaction.gameSession.userId !== user.id) {
    return c.json({ error: "Transaction not found" }, 404);
  }

  const transaction = await db.playerTransaction.update({
    where: { id },
    data: { isPaid: true },
  });

  console.log(`💰 [Players] Transaction marked as paid: ${transaction.id}`);

  return c.json({
    transaction: {
      id: transaction.id,
      playerName: transaction.playerName,
      type: transaction.type as "buy-in" | "cashout",
      amount: transaction.amount,
      paymentMethod: transaction.paymentMethod as "cash" | "electronic" | "credit",
      notes: transaction.notes,
      isPaid: transaction.isPaid,
      timestamp: transaction.timestamp.toISOString(),
      gameSessionId: transaction.gameSessionId,
    },
  });
});

// ============================================
// PUT /api/players/transaction/:id/mark-unpaid - Mark a credit transaction as unpaid
// ============================================
playersRouter.put("/transaction/:id/mark-unpaid", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  console.log(`💰 [Players] Marking transaction as unpaid: ${id} (user: ${user.email})`);

  // Verify the transaction belongs to a session owned by this user
  const existingTransaction = await db.playerTransaction.findUnique({
    where: { id },
    include: { gameSession: true },
  });

  if (!existingTransaction || existingTransaction.gameSession.userId !== user.id) {
    return c.json({ error: "Transaction not found" }, 404);
  }

  const transaction = await db.playerTransaction.update({
    where: { id },
    data: { isPaid: false },
  });

  console.log(`💰 [Players] Transaction marked as unpaid: ${transaction.id}`);

  return c.json({
    transaction: {
      id: transaction.id,
      playerName: transaction.playerName,
      type: transaction.type as "buy-in" | "cashout",
      amount: transaction.amount,
      paymentMethod: transaction.paymentMethod as "cash" | "electronic" | "credit",
      notes: transaction.notes,
      isPaid: transaction.isPaid,
      timestamp: transaction.timestamp.toISOString(),
      gameSessionId: transaction.gameSessionId,
    },
  });
});

export { playersRouter };
