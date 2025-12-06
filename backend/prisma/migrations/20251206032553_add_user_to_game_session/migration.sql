/*
  Warnings:

  - Added the required column `userId` to the `game_session` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_game_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Poker Game',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tableName" TEXT NOT NULL DEFAULT 'Main Table',
    "userId" TEXT NOT NULL,
    CONSTRAINT "game_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_game_session" ("createdAt", "endedAt", "id", "isActive", "name", "startedAt", "tableName", "updatedAt") SELECT "createdAt", "endedAt", "id", "isActive", "name", "startedAt", "tableName", "updatedAt" FROM "game_session";
DROP TABLE "game_session";
ALTER TABLE "new_game_session" RENAME TO "game_session";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
