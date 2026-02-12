// contracts.ts
// Shared API contracts (schemas and types) used by both the server and the app.
// Import in the app as: `import { type GetSampleResponse } from "@shared/contracts"`
// Import in the server as: `import { postSampleRequestSchema } from "@shared/contracts"`

import { z } from "zod";

// ============================================
// POKER GAME CONTRACTS
// ============================================

// Game Session
export const gameSessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  tableName: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  currency: z.string().default("USD"),
  language: z.string().default("en"),
  totalRake: z.number().default(0),
});
export type GameSession = z.infer<typeof gameSessionSchema>;

// Player Transaction
export const playerTransactionSchema = z.object({
  id: z.string(),
  playerName: z.string(),
  type: z.enum(["buy-in", "cashout"]),
  amount: z.number(),
  paymentMethod: z.enum(["cash", "electronic", "credit"]),
  notes: z.string().nullable(),
  isPaid: z.boolean().optional().default(true),
  timestamp: z.string(),
  gameSessionId: z.string(),
  createdByInitials: z.string().nullable().optional(),
});
export type PlayerTransaction = z.infer<typeof playerTransactionSchema>;

// Dealer Down
export const dealerDownSchema = z.object({
  id: z.string(),
  dealerName: z.string(),
  tips: z.number(),
  rake: z.number(),
  tipsPaid: z.boolean(),
  rakeClaimed: z.boolean(),
  timestamp: z.string(),
  gameSessionId: z.string(),
  createdByInitials: z.string().nullable().optional(),
});
export type DealerDown = z.infer<typeof dealerDownSchema>;

// Expense
export const expenseSchema = z.object({
  id: z.string(),
  description: z.string(),
  amount: z.number(),
  category: z.enum(["food", "drinks", "other"]),
  paymentMethod: z.enum(["cash", "electronic"]),
  paidOut: z.boolean(),
  notes: z.string().nullable(),
  timestamp: z.string(),
  gameSessionId: z.string(),
  createdByInitials: z.string().nullable().optional(),
});
export type Expense = z.infer<typeof expenseSchema>;

// GET /api/game/active - Get or create active game session
export const getActiveGameResponseSchema = z.object({
  session: gameSessionSchema,
  userCompletedGames: z.number(),
});
export type GetActiveGameResponse = z.infer<typeof getActiveGameResponseSchema>;

// POST /api/game/end - End current game session
export const endGameRequestSchema = z.object({
  sessionId: z.string(),
});
export type EndGameRequest = z.infer<typeof endGameRequestSchema>;
export const endGameResponseSchema = z.object({
  success: z.boolean(),
  session: gameSessionSchema,
});
export type EndGameResponse = z.infer<typeof endGameResponseSchema>;

// DELETE /api/game/:sessionId - Delete a game session
export const deleteGameResponseSchema = z.object({
  success: z.boolean(),
});
export type DeleteGameResponse = z.infer<typeof deleteGameResponseSchema>;

// POST /api/game/new - Start a new game session
export const startNewGameRequestSchema = z.object({
  currency: z.string().optional().default("USD"),
  language: z.string().optional().default("en"),
});
export type StartNewGameRequest = z.infer<typeof startNewGameRequestSchema>;

export const startNewGameResponseSchema = z.object({
  session: gameSessionSchema,
});
export type StartNewGameResponse = z.infer<typeof startNewGameResponseSchema>;

// GET /api/game/history - Get all inactive game sessions
export const gameSessionWithDataSchema = gameSessionSchema.extend({
  playerTransactions: z.array(playerTransactionSchema),
  dealerDowns: z.array(dealerDownSchema),
  expenses: z.array(expenseSchema),
});
export type GameSessionWithData = z.infer<typeof gameSessionWithDataSchema>;

export const getGameHistoryResponseSchema = z.object({
  sessions: z.array(gameSessionWithDataSchema),
});
export type GetGameHistoryResponse = z.infer<typeof getGameHistoryResponseSchema>;

// GET /api/game/:sessionId/summary - Get game session summary
export const gameSummarySchema = z.object({
  session: gameSessionSchema,
  totalBuyIns: z.number(),
  totalCashouts: z.number(),
  totalTips: z.number(),
  totalRake: z.number(),
  totalExpenses: z.number(),
  netProfit: z.number(),
  tillBalance: z.number(),
  playerCount: z.number(),
  creditBalance: z.number(), // Total credit owed by all players
});
export type GameSummary = z.infer<typeof gameSummarySchema>;

// POST /api/players/transaction - Add player transaction
export const addPlayerTransactionRequestSchema = z.object({
  playerName: z.string().min(1),
  type: z.enum(["buy-in", "cashout"]),
  amount: z.number().positive(),
  paymentMethod: z.enum(["cash", "electronic", "credit"]),
  notes: z.string().optional(),
  gameSessionId: z.string(),
});
export type AddPlayerTransactionRequest = z.infer<typeof addPlayerTransactionRequestSchema>;
export const addPlayerTransactionResponseSchema = z.object({
  transaction: playerTransactionSchema,
});
export type AddPlayerTransactionResponse = z.infer<typeof addPlayerTransactionResponseSchema>;

// PUT /api/players/transaction/:id - Update player transaction
export const updatePlayerTransactionRequestSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(["cash", "electronic", "credit"]),
  notes: z.string().optional(),
});
export type UpdatePlayerTransactionRequest = z.infer<typeof updatePlayerTransactionRequestSchema>;
export const updatePlayerTransactionResponseSchema = z.object({
  transaction: playerTransactionSchema,
});
export type UpdatePlayerTransactionResponse = z.infer<typeof updatePlayerTransactionResponseSchema>;

// GET /api/players/transactions/:sessionId - Get all player transactions for a session
export const getPlayerTransactionsResponseSchema = z.object({
  transactions: z.array(playerTransactionSchema),
});
export type GetPlayerTransactionsResponse = z.infer<typeof getPlayerTransactionsResponseSchema>;

// POST /api/dealers/down - Add dealer down
export const addDealerDownRequestSchema = z.object({
  dealerName: z.string().min(1),
  tips: z.number().min(0),
  rake: z.number().min(0),
  gameSessionId: z.string(),
});
export type AddDealerDownRequest = z.infer<typeof addDealerDownRequestSchema>;
export const addDealerDownResponseSchema = z.object({
  dealerDown: dealerDownSchema,
});
export type AddDealerDownResponse = z.infer<typeof addDealerDownResponseSchema>;

// GET /api/dealers/downs/:sessionId - Get all dealer downs for a session
export const getDealerDownsResponseSchema = z.object({
  downs: z.array(dealerDownSchema),
});
export type GetDealerDownsResponse = z.infer<typeof getDealerDownsResponseSchema>;

// PUT /api/dealers/down/:id - Update dealer down
export const updateDealerDownRequestSchema = z.object({
  dealerName: z.string().min(1),
  tips: z.number().min(0),
  rake: z.number().min(0),
});
export type UpdateDealerDownRequest = z.infer<typeof updateDealerDownRequestSchema>;
export const updateDealerDownResponseSchema = z.object({
  dealerDown: dealerDownSchema,
});
export type UpdateDealerDownResponse = z.infer<typeof updateDealerDownResponseSchema>;

// PUT /api/dealers/down/:id/pay - Mark dealer tips as paid
export const markDealerTipsPaidResponseSchema = z.object({
  dealerDown: dealerDownSchema,
});
export type MarkDealerTipsPaidResponse = z.infer<typeof markDealerTipsPaidResponseSchema>;

// POST /api/dealers/claim-tips-by-dealer - Claim all tips for a specific dealer
export const claimTipsByDealerRequestSchema = z.object({
  dealerName: z.string().min(1),
  gameSessionId: z.string(),
  percentage: z.number().min(0).max(100).default(100), // Percentage of tips to claim (for owner's cut)
});
export type ClaimTipsByDealerRequest = z.infer<typeof claimTipsByDealerRequestSchema>;
export const claimTipsByDealerResponseSchema = z.object({
  updatedCount: z.number(),
  totalTipsClaimed: z.number(),
  ownerCut: z.number(), // Amount kept by owner (100% - percentage)
  dealerPayout: z.number(), // Amount paid to dealer
});
export type ClaimTipsByDealerResponse = z.infer<typeof claimTipsByDealerResponseSchema>;

// POST /api/dealers/claim-all-rake - Claim all rake from all dealers
export const claimAllRakeRequestSchema = z.object({
  gameSessionId: z.string(),
});
export type ClaimAllRakeRequest = z.infer<typeof claimAllRakeRequestSchema>;
export const claimAllRakeResponseSchema = z.object({
  updatedCount: z.number(),
  totalRakeClaimed: z.number(),
});
export type ClaimAllRakeResponse = z.infer<typeof claimAllRakeResponseSchema>;

// PUT /api/dealers/total-rake - Update total rake for session
export const updateTotalRakeRequestSchema = z.object({
  gameSessionId: z.string(),
  totalRake: z.number().min(0),
});
export type UpdateTotalRakeRequest = z.infer<typeof updateTotalRakeRequestSchema>;
export const updateTotalRakeResponseSchema = z.object({
  session: gameSessionSchema,
  totalRake: z.number(),
});
export type UpdateTotalRakeResponse = z.infer<typeof updateTotalRakeResponseSchema>;

// POST /api/expenses - Add expense
export const addExpenseRequestSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  category: z.enum(["food", "drinks", "other"]),
  paymentMethod: z.enum(["cash", "electronic"]),
  notes: z.string().optional(),
  gameSessionId: z.string(),
});
export type AddExpenseRequest = z.infer<typeof addExpenseRequestSchema>;
export const addExpenseResponseSchema = z.object({
  expense: expenseSchema,
});
export type AddExpenseResponse = z.infer<typeof addExpenseResponseSchema>;

// GET /api/expenses/:sessionId - Get all expenses for a session
export const getExpensesResponseSchema = z.object({
  expenses: z.array(expenseSchema),
});
export type GetExpensesResponse = z.infer<typeof getExpensesResponseSchema>;

// PUT /api/expenses/:id - Update an expense
export const updateExpenseRequestSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  category: z.enum(["food", "drinks", "other"]),
  paymentMethod: z.enum(["cash", "electronic"]),
  notes: z.string().optional(),
});
export type UpdateExpenseRequest = z.infer<typeof updateExpenseRequestSchema>;
export const updateExpenseResponseSchema = z.object({
  expense: expenseSchema,
});
export type UpdateExpenseResponse = z.infer<typeof updateExpenseResponseSchema>;

// ============================================
// AI TILL ANALYST CONTRACTS
// ============================================

// POST /api/ai/analyze-till - AI analysis of till discrepancy
export const analyzeTillRequestSchema = z.object({
  sessionId: z.string(),
  actualTillAmount: z.number(),
});
export type AnalyzeTillRequest = z.infer<typeof analyzeTillRequestSchema>;

export const tillAnalysisCauseSchema = z.object({
  description: z.string(),
  likelihood: z.enum(["high", "medium", "low"]),
  amount: z.number().optional(),
  transactionIds: z.array(z.string()).optional(),
});
export type TillAnalysisCause = z.infer<typeof tillAnalysisCauseSchema>;

export const transactionToReviewSchema = z.object({
  id: z.string(),
  playerName: z.string(),
  type: z.string(),
  amount: z.number(),
  paymentMethod: z.string(),
  notes: z.string().nullable(),
  reason: z.string(),
});
export type TransactionToReview = z.infer<typeof transactionToReviewSchema>;

export const analyzeTillResponseSchema = z.object({
  discrepancyAmount: z.number(),
  expectedTill: z.number(),
  actualTill: z.number(),
  summary: z.string(),
  possibleCauses: z.array(tillAnalysisCauseSchema),
  transactionsToReview: z.array(transactionToReviewSchema),
  recommendations: z.array(z.string()),
});
export type AnalyzeTillResponse = z.infer<typeof analyzeTillResponseSchema>;
