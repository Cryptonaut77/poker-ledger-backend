-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "category" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "paidOut" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gameSessionId" TEXT NOT NULL,
    CONSTRAINT "expense_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "game_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_expense" ("amount", "category", "description", "gameSessionId", "id", "notes", "timestamp") SELECT "amount", "category", "description", "gameSessionId", "id", "notes", "timestamp" FROM "expense";
DROP TABLE "expense";
ALTER TABLE "new_expense" RENAME TO "expense";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
