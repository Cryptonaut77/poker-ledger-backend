-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_dealer_down" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealerName" TEXT NOT NULL,
    "tips" REAL NOT NULL DEFAULT 0,
    "rake" REAL NOT NULL DEFAULT 0,
    "tipsPaid" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gameSessionId" TEXT NOT NULL,
    CONSTRAINT "dealer_down_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "game_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_dealer_down" ("dealerName", "gameSessionId", "id", "rake", "timestamp", "tips") SELECT "dealerName", "gameSessionId", "id", "rake", "timestamp", "tips" FROM "dealer_down";
DROP TABLE "dealer_down";
ALTER TABLE "new_dealer_down" RENAME TO "dealer_down";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
