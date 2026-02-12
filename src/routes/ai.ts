import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import OpenAI from "openai";
import {
  analyzeTillRequestSchema,
  type AnalyzeTillResponse,
  type TillAnalysisCause,
  type TransactionToReview,
} from "@/shared/contracts";
import { type AppType } from "../types";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";

const aiRouter = new Hono<AppType>();

// Apply auth middleware to all AI routes
aiRouter.use("*", requireAuth);

// ============================================
// POST /api/ai/analyze-till - AI analysis of till discrepancy
// ============================================
aiRouter.post("/analyze-till", zValidator("json", analyzeTillRequestSchema), async (c) => {
  const user = c.get("user")!;
  const { sessionId, actualTillAmount } = c.req.valid("json");

  console.log(`🤖 [AI] Analyzing till discrepancy for session: ${sessionId}, user: ${user.email}`);
  console.log(`🤖 [AI] Actual till amount reported: $${actualTillAmount}`);

  // Check if OpenAI API key is configured
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.log(`❌ [AI] OpenAI API key not configured`);
    return c.json({ error: "AI analysis is not configured. Please contact support." }, 500);
  }

  // Check if user has access to the session (owner or member)
  const session = await db.gameSession.findFirst({
    where: {
      id: sessionId,
      OR: [
        { userId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    },
    include: {
      playerTransactions: {
        orderBy: { timestamp: "asc" },
      },
      dealerDowns: {
        orderBy: { timestamp: "asc" },
      },
      expenses: {
        orderBy: { timestamp: "asc" },
      },
    },
  });

  if (!session) {
    console.log(`❌ [AI] Session not found: ${sessionId}`);
    return c.json({ error: "Session not found" }, 404);
  }

  // Calculate expected till balance (same logic as summary endpoint)
  const cashBuyIns = session.playerTransactions
    .filter((t) => t.type === "buy-in" && t.paymentMethod === "cash")
    .reduce((sum, t) => sum + t.amount, 0);

  const cashCashouts = session.playerTransactions
    .filter((t) => t.type === "cashout" && t.paymentMethod === "cash")
    .reduce((sum, t) => {
      if (t.notes) {
        const newMatch = t.notes.match(/received \$(\d+(?:\.\d{2})?) cash/);
        if (newMatch?.[1]) return sum + parseFloat(newMatch[1]);
        const oldMatch = t.notes.match(/cash paid: \$(\d+(?:\.\d{2})?)\)/);
        if (oldMatch?.[1]) return sum + parseFloat(oldMatch[1]);
      }
      return sum + t.amount;
    }, 0);

  const autoSettledCredit = session.playerTransactions
    .filter((t) => t.type === "cashout" && (t.notes?.includes("credit settled:") || t.notes?.includes("paid $")))
    .reduce((sum, t) => {
      const oldMatch = t.notes?.match(/credit settled: \$(\d+(?:\.\d{2})?)/);
      if (oldMatch?.[1]) return sum + parseFloat(oldMatch[1]);
      const newMatch = t.notes?.match(/paid \$(\d+(?:\.\d{2})?) credit/);
      return sum + (newMatch?.[1] ? parseFloat(newMatch[1]) : 0);
    }, 0);

  const paidCreditBuyIns = session.playerTransactions
    .filter((t) => t.type === "buy-in" && t.paymentMethod === "credit" && t.isPaid === true)
    .reduce((sum, t) => sum + t.amount, 0);

  const manuallyPaidCredit = Math.max(0, paidCreditBuyIns - autoSettledCredit);

  const totalPaidTips = session.dealerDowns
    .filter((d) => d.tipsPaid)
    .reduce((sum, d) => sum + d.tips, 0);

  const totalClaimedRake = session.dealerDowns
    .filter((d) => d.rakeClaimed)
    .reduce((sum, d) => sum + d.rake, 0);

  const totalExpenses = session.expenses.reduce((sum, e) => sum + e.amount, 0);

  const expectedTill = cashBuyIns + manuallyPaidCredit - cashCashouts - totalPaidTips - totalClaimedRake - totalExpenses;
  const discrepancyAmount = actualTillAmount - expectedTill;

  console.log(`🤖 [AI] Expected till: $${expectedTill.toFixed(2)}, Actual: $${actualTillAmount}, Discrepancy: $${discrepancyAmount.toFixed(2)}`);

  // If there's no significant discrepancy, return early
  if (Math.abs(discrepancyAmount) < 1) {
    return c.json({
      discrepancyAmount: 0,
      expectedTill,
      actualTill: actualTillAmount,
      summary: "Your till matches the expected amount. No discrepancy detected.",
      possibleCauses: [],
      transactionsToReview: [],
      recommendations: ["Your records appear to be accurate. Keep up the good work!"],
    } satisfies AnalyzeTillResponse);
  }

  // Format transaction data for AI
  const formattedTransactions = session.playerTransactions.map((t) => ({
    id: t.id,
    player: t.playerName,
    type: t.type,
    amount: t.amount,
    paymentMethod: t.paymentMethod,
    isPaid: t.isPaid,
    notes: t.notes,
    timestamp: t.timestamp.toISOString(),
    createdBy: t.createdByInitials || "unknown",
  }));

  const formattedDealerDowns = session.dealerDowns.map((d) => ({
    id: d.id,
    dealer: d.dealerName,
    tips: d.tips,
    rake: d.rake,
    tipsPaid: d.tipsPaid,
    rakeClaimed: d.rakeClaimed,
    timestamp: d.timestamp.toISOString(),
    createdBy: d.createdByInitials || "unknown",
  }));

  const formattedExpenses = session.expenses.map((e) => ({
    id: e.id,
    description: e.description,
    amount: e.amount,
    category: e.category,
    paymentMethod: e.paymentMethod,
    paidOut: e.paidOut,
    notes: e.notes,
    timestamp: e.timestamp.toISOString(),
    createdBy: e.createdByInitials || "unknown",
  }));

  // Build the AI prompt
  const systemPrompt = `You are an expert poker game financial analyst. You help game managers identify why their physical cash till doesn't match the expected amount calculated by the app.

You analyze transaction patterns, payment methods, timing, and common accounting errors to identify the most likely causes of discrepancies.

Always provide:
1. A clear summary of the discrepancy (1-2 sentences)
2. Ranked possible causes with likelihood assessments (high/medium/low)
3. Specific transactions that warrant review with clear reasons why
4. Actionable recommendations

Be precise with numbers. Consider these common issues:
- Unpaid credit buy-ins being counted as cash (credit not marked)
- Electronic payments miscategorized as cash
- Tips/rake paid out but not marked as paid in app
- Cashouts with credit settlements not properly recorded
- Expenses not recorded or miscategorized
- Simple counting errors or missed entries
- Potential theft or unauthorized withdrawals
- Round number patterns that suggest estimation rather than exact counting

You MUST respond with valid JSON matching this exact structure:
{
  "summary": "string describing the discrepancy",
  "possibleCauses": [
    {
      "description": "string",
      "likelihood": "high" | "medium" | "low",
      "amount": number (optional, estimated amount this cause could explain),
      "transactionIds": ["id1", "id2"] (optional, related transaction IDs)
    }
  ],
  "transactionsToReview": [
    {
      "id": "transaction id",
      "playerName": "string",
      "type": "buy-in" | "cashout",
      "amount": number,
      "paymentMethod": "cash" | "electronic" | "credit",
      "notes": "string or null",
      "reason": "why this transaction should be reviewed"
    }
  ],
  "recommendations": ["actionable step 1", "actionable step 2"]
}`;

  const userPrompt = `Analyze this poker game session for a till discrepancy.

DISCREPANCY:
- Expected Till: $${expectedTill.toFixed(2)}
- Actual Till: $${actualTillAmount.toFixed(2)}
- Discrepancy: $${discrepancyAmount.toFixed(2)} (${discrepancyAmount > 0 ? "OVER - more cash than expected" : "SHORT - less cash than expected"})

SESSION DATA:
Currency: ${session.currency}
Started: ${session.startedAt.toISOString()}
Session ID: ${session.id}

TRANSACTIONS (${session.playerTransactions.length} total):
${JSON.stringify(formattedTransactions, null, 2)}

DEALER DOWNS (${session.dealerDowns.length} total):
${JSON.stringify(formattedDealerDowns, null, 2)}

EXPENSES (${session.expenses.length} total):
${JSON.stringify(formattedExpenses, null, 2)}

CALCULATED BREAKDOWN:
- Cash Buy-ins: $${cashBuyIns.toFixed(2)}
- Manually Paid Credit: $${manuallyPaidCredit.toFixed(2)}
- Auto-Settled Credit: $${autoSettledCredit.toFixed(2)}
- Cash Cashouts: $${cashCashouts.toFixed(2)}
- Paid Tips: $${totalPaidTips.toFixed(2)}
- Claimed Rake: $${totalClaimedRake.toFixed(2)}
- Expenses: $${totalExpenses.toFixed(2)}

Identify the most likely causes for this $${Math.abs(discrepancyAmount).toFixed(2)} discrepancy.`;

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });

    console.log(`🤖 [AI] Sending request to OpenAI...`);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    console.log(`🤖 [AI] Received response from OpenAI`);

    // Parse the JSON response
    const aiResponse = JSON.parse(responseText);

    // Validate and transform the response
    const possibleCauses: TillAnalysisCause[] = (aiResponse.possibleCauses || []).map((cause: any) => ({
      description: String(cause.description || ""),
      likelihood: ["high", "medium", "low"].includes(cause.likelihood) ? cause.likelihood : "medium",
      amount: typeof cause.amount === "number" ? cause.amount : undefined,
      transactionIds: Array.isArray(cause.transactionIds) ? cause.transactionIds : undefined,
    }));

    const transactionsToReview: TransactionToReview[] = (aiResponse.transactionsToReview || []).map((t: any) => ({
      id: String(t.id || ""),
      playerName: String(t.playerName || "Unknown"),
      type: String(t.type || ""),
      amount: typeof t.amount === "number" ? t.amount : 0,
      paymentMethod: String(t.paymentMethod || ""),
      notes: t.notes || null,
      reason: String(t.reason || ""),
    }));

    const recommendations: string[] = Array.isArray(aiResponse.recommendations)
      ? aiResponse.recommendations.map((r: any) => String(r))
      : ["Review all transactions for accuracy", "Double-check cash counts"];

    const response: AnalyzeTillResponse = {
      discrepancyAmount,
      expectedTill,
      actualTill: actualTillAmount,
      summary: String(aiResponse.summary || `Till is ${discrepancyAmount > 0 ? "over" : "short"} by $${Math.abs(discrepancyAmount).toFixed(2)}`),
      possibleCauses,
      transactionsToReview,
      recommendations,
    };

    console.log(`🤖 [AI] Analysis complete - found ${possibleCauses.length} possible causes`);
    return c.json(response);
  } catch (error: any) {
    console.error(`❌ [AI] OpenAI API error:`, error);
    return c.json({
      error: "Failed to analyze till discrepancy. Please try again.",
      details: error.message,
    }, 500);
  }
});

export { aiRouter };
