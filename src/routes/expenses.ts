import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  addExpenseRequestSchema,
  updateExpenseRequestSchema,
  type AddExpenseResponse,
  type GetExpensesResponse,
  type UpdateExpenseResponse,
} from "@/shared/contracts";
import { type AppType } from "../types";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";

const expensesRouter = new Hono<AppType>();

// Apply auth middleware to all expense routes
expensesRouter.use("*", requireAuth);

// ============================================
// POST /api/expenses - Add expense
// ============================================
expensesRouter.post("/", zValidator("json", addExpenseRequestSchema), async (c) => {
  const user = c.get("user")!;
  const data = c.req.valid("json");
  console.log(`💸 [Expenses] Adding expense: ${data.description} - $${data.amount} (${data.paymentMethod}) (user: ${user.email})`);

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

  const expense = await db.expense.create({
    data: {
      description: data.description,
      amount: data.amount,
      category: data.category,
      paymentMethod: data.paymentMethod,
      notes: data.notes ?? null,
      gameSessionId: data.gameSessionId,
      createdById: user.id,
      createdByInitials: initials,
    },
  });

  console.log(`💸 [Expenses] Expense created: ${expense.id} by ${initials}`);

  return c.json({
    expense: {
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      category: expense.category as "food" | "drinks" | "other",
      paymentMethod: expense.paymentMethod as "cash" | "electronic",
      paidOut: expense.paidOut,
      notes: expense.notes,
      timestamp: expense.timestamp.toISOString(),
      gameSessionId: expense.gameSessionId,
      createdByInitials: expense.createdByInitials,
    },
  } satisfies AddExpenseResponse);
});

// ============================================
// GET /api/expenses/:sessionId - Get all expenses
// ============================================
expensesRouter.get("/:sessionId", async (c) => {
  const user = c.get("user")!;
  const sessionId = c.req.param("sessionId");
  console.log(`💸 [Expenses] Getting expenses for session: ${sessionId} (user: ${user.email})`);

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

  const expenses = await db.expense.findMany({
    where: { gameSessionId: sessionId },
    orderBy: { timestamp: "desc" },
  });

  console.log(`💸 [Expenses] Found ${expenses.length} expenses`);

  return c.json({
    expenses: expenses.map((e) => ({
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
  } satisfies GetExpensesResponse);
});

// ============================================
// DELETE /api/expenses/:id - Delete an expense
// ============================================
expensesRouter.delete("/:id", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  console.log(`💸 [Expenses] Deleting expense: ${id} (user: ${user.email})`);

  // Verify the expense belongs to a session owned by this user
  const expense = await db.expense.findUnique({
    where: { id },
    include: { gameSession: true },
  });

  if (!expense || expense.gameSession.userId !== user.id) {
    return c.json({ error: "Expense not found" }, 404);
  }

  await db.expense.delete({
    where: { id },
  });

  console.log(`💸 [Expenses] Expense deleted: ${id}`);

  return c.json({ success: true });
});

// ============================================
// PUT /api/expenses/:id - Update an expense
// ============================================
expensesRouter.put("/:id", zValidator("json", updateExpenseRequestSchema), async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const data = c.req.valid("json");
  console.log(`💸 [Expenses] Updating expense: ${id} (user: ${user.email})`);

  // Verify the expense belongs to a session owned by this user
  const existingExpense = await db.expense.findUnique({
    where: { id },
    include: { gameSession: true },
  });

  if (!existingExpense || existingExpense.gameSession.userId !== user.id) {
    return c.json({ error: "Expense not found" }, 404);
  }

  const expense = await db.expense.update({
    where: { id },
    data: {
      description: data.description,
      amount: data.amount,
      category: data.category,
      paymentMethod: data.paymentMethod,
      notes: data.notes ?? null,
    },
  });

  console.log(`💸 [Expenses] Expense updated: ${expense.id}`);

  return c.json({
    expense: {
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      category: expense.category as "food" | "drinks" | "other",
      paymentMethod: expense.paymentMethod as "cash" | "electronic",
      paidOut: expense.paidOut,
      notes: expense.notes,
      timestamp: expense.timestamp.toISOString(),
      gameSessionId: expense.gameSessionId,
    },
  } satisfies UpdateExpenseResponse);
});

export { expensesRouter };
