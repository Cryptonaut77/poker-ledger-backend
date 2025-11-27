import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  addExpenseRequestSchema,
  type AddExpenseResponse,
  type GetExpensesResponse,
} from "@/shared/contracts";
import { type AppType } from "../types";
import { db } from "../db";

const expensesRouter = new Hono<AppType>();

// ============================================
// POST /api/expenses - Add expense
// ============================================
expensesRouter.post("/", zValidator("json", addExpenseRequestSchema), async (c) => {
  const data = c.req.valid("json");
  console.log(`💸 [Expenses] Adding expense: ${data.description} - $${data.amount}`);

  const expense = await db.expense.create({
    data: {
      description: data.description,
      amount: data.amount,
      category: data.category,
      notes: data.notes ?? null,
      gameSessionId: data.gameSessionId,
    },
  });

  console.log(`💸 [Expenses] Expense created: ${expense.id}`);

  return c.json({
    expense: {
      ...expense,
      timestamp: expense.timestamp.toISOString(),
    },
  } satisfies AddExpenseResponse);
});

// ============================================
// GET /api/expenses/:sessionId - Get all expenses
// ============================================
expensesRouter.get("/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  console.log(`💸 [Expenses] Getting expenses for session: ${sessionId}`);

  const expenses = await db.expense.findMany({
    where: { gameSessionId: sessionId },
    orderBy: { timestamp: "desc" },
  });

  console.log(`💸 [Expenses] Found ${expenses.length} expenses`);

  return c.json({
    expenses: expenses.map((e) => ({
      ...e,
      timestamp: e.timestamp.toISOString(),
    })),
  } satisfies GetExpensesResponse);
});

// ============================================
// DELETE /api/expenses/:id - Delete an expense
// ============================================
expensesRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  console.log(`💸 [Expenses] Deleting expense: ${id}`);

  await db.expense.delete({
    where: { id },
  });

  console.log(`💸 [Expenses] Expense deleted: ${id}`);

  return c.json({ success: true });
});

export { expensesRouter };
