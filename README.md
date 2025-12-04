# Poker Game Manager

A beautiful, sophisticated mobile app for managing home poker games. Track player buy-ins, cashouts, dealer tips, rake, and expenses all in one place.

## Features

### 🎮 Game Session Management
- Automatic game session creation
- Real-time game tracking
- Comprehensive game summary with net profit calculations
- End & save game for record keeping
- Quick-start new game
- Delete game and all associated data
- **Game history** - View all past saved games with full statistics
- Delete saved games from history

### 💰 Player Tracking
- Log player buy-ins with multiple payment methods (cash, electronic, credit)
- Visual payment method indicators with colored dots (green=cash, blue=electronic, yellow=credit)
- Track cashouts
- Voice-to-text support with automatic duplicate prevention
- View complete transaction history
- Edit or delete transactions with intuitive modal interface
- Add notes to transactions

### 🎲 Dealer Management
- Track dealer tips per down
- Log rake collected
- **Grouped by dealer** - All downs for each dealer are consolidated in one section
- **Expandable view** - Tap to expand/collapse individual dealer downs
- Shows consolidated totals: total tips, total rake, and grand total per dealer
- Visual status indicators (All Paid, Partial, Unpaid)
- Displays number of downs per dealer
- Editable text inputs for dealer name, tips, and rake amounts
- Edit dealer downs with blue edit icon
- Delete dealer downs from edit modal
- **Separate tabs for Tips and Rake**:
  - **Pay Dealers tab**: Track and pay out dealer tips independently
  - **Claim Rake tab**: Track and claim house rake separately
- Mark tips as paid with one-tap button
- Mark rake as claimed with one-tap button
- **Mark tips as unpaid** - Toggle paid tips back to unpaid status
- **Mark rake as unclaimed** - Toggle claimed rake back to unclaimed status
- View paid/unpaid and claimed/unclaimed status with color-coded badges
- View dealer performance history
- Database fully supports independent tip payment and rake claiming

### 💸 Expense Tracking
- Log comped food, drinks, and other expenses
- Categorize expenses for easy reporting
- Add notes for detailed record-keeping
- Edit expenses with blue edit icon
- Delete expenses from edit modal

### 📊 Dashboard
- Real-time net profit display
- Till balance showing actual cash on hand
- Summary of all financial metrics
- Player count tracking
- Separate tracking for paid vs unpaid dealer tips
- Beautiful, intuitive interface

## Tech Stack

### Frontend
- **Framework**: Expo SDK 53 + React Native 0.76.7
- **Navigation**: React Navigation 7 (native stack + bottom tabs)
- **Styling**: NativewindCSS (Tailwind for React Native)
- **State Management**: TanStack Query (React Query) for server state
- **Icons**: Lucide React Native
- **Animations**: Expo Haptics for tactile feedback

### Backend
- **Runtime**: Bun
- **Framework**: Hono (lightweight, fast web framework)
- **Database**: SQLite with Prisma ORM
- **Authentication**: Better Auth with email/password

## App Structure

### Screens
- **DashboardScreen** (`src/screens/DashboardScreen.tsx`) - Main game overview with stats
- **PlayersScreen** (`src/screens/PlayersScreen.tsx`) - Player buy-ins and cashouts
- **DealersScreen** (`src/screens/DealersScreen.tsx`) - Dealer tips and rake tracking
- **ExpensesScreen** (`src/screens/ExpensesScreen.tsx`) - Expense management
- **GameHistoryScreen** (`src/screens/GameHistoryScreen.tsx`) - View past saved games
- **LoginModalScreen** (`src/screens/LoginModalScreen.tsx`) - Authentication

### Backend API Routes
- **Game Routes** (`/api/game/*`)
  - `GET /api/game/active` - Get or create active game session
  - `GET /api/game/history` - Get all inactive (saved) game sessions
  - `POST /api/game/end` - End current game session
  - `POST /api/game/new` - Start a new game session
  - `DELETE /api/game/:sessionId` - Delete a game session
  - `GET /api/game/:sessionId/summary` - Get game summary with calculations

- **Player Routes** (`/api/players/*`)
  - `POST /api/players/transaction` - Add buy-in or cashout
  - `GET /api/players/transactions/:sessionId` - Get all transactions
  - `PUT /api/players/transaction/:id` - Update a transaction
  - `DELETE /api/players/transaction/:id` - Delete a transaction

- **Dealer Routes** (`/api/dealers/*`)
  - `POST /api/dealers/down` - Add dealer down
  - `GET /api/dealers/downs/:sessionId` - Get all dealer downs
  - `PUT /api/dealers/down/:id/pay` - Mark dealer tips as paid
  - `PUT /api/dealers/down/:id/unpay` - Mark dealer tips as unpaid
  - `PUT /api/dealers/down/:id/claim-rake` - Mark rake as claimed
  - `PUT /api/dealers/down/:id/unclaim-rake` - Mark rake as unclaimed
  - `DELETE /api/dealers/down/:id` - Delete a dealer down

- **Expense Routes** (`/api/expenses/*`)
  - `POST /api/expenses` - Add expense
  - `GET /api/expenses/:sessionId` - Get all expenses
  - `PUT /api/expenses/:id` - Update an expense
  - `DELETE /api/expenses/:id` - Delete an expense

### Database Schema
- **GameSession** - Poker game sessions with start/end times
- **PlayerTransaction** - Buy-ins and cashouts with payment methods
- **DealerDown** - Dealer tips and rake per down
- **Expense** - Tracked expenses by category

### Error Handling
The app includes intelligent error classification and automatic retry logic:
- **Network Errors**: "Unable to connect to server" - indicates sandbox/connectivity issues
- **Server Errors**: Includes error code and details - indicates potential code bugs
- **Validation Errors**: Invalid data submitted - indicates user input issues
- **Not Found Errors**: Data was deleted or doesn't exist
- **Auth Errors**: Authentication problems - restart app to fix

**Automatic Retry**: All API requests automatically retry up to 5 times with exponential backoff (1s, 2s, 4s, 8s, 10s) to handle temporary network issues like 502 errors from the Vibecode proxy.

This helps distinguish between temporary infrastructure issues (Vibecode sandbox) and actual app bugs.

## Design

The app features a sophisticated poker room aesthetic:
- **Color Palette**: Deep slate backgrounds with poker green accents (#1a5742)
- **Typography**: Clean, bold fonts for easy reading
- **UI Elements**: Card-based layouts with subtle shadows and borders
- **Interactions**: Haptic feedback for all user actions
- **Visual Feedback**:
  - Color-coded transactions (green for buy-ins, red for cashouts)
  - Payment method indicators with colored dots (green=cash, blue=electronic, yellow=credit)
  - Blue edit icons for transaction management

## Usage

### Managing Game Sessions
To manage your poker game:
1. Navigate to the Dashboard tab
2. Tap the "Manage" button in the top right
3. Choose an action:
   - **End & Save Game**: Marks the game as complete and saves it for record keeping
   - **Start New Game**: Ends the current game and creates a fresh one
   - **Delete Game**: Permanently removes the game and all associated data (cannot be undone)

### Starting a Game
The app automatically creates a game session when you first open it. All transactions, dealer downs, and expenses are tied to the active game.

### Tracking Players
1. Navigate to the Players tab
2. Tap the green "+" button to add a buy-in
3. Tap the red "$" button to add a cashout
4. Select payment method (cash, electronic, or credit)
5. Add optional notes for record-keeping
6. View payment methods at a glance with colored dots next to player names
7. Tap the blue edit icon on any transaction to edit or delete it

### Logging Dealer Activity
1. Navigate to the Dealers tab
2. Tap the "+" button
3. Enter dealer name, tips, and rake
4. Submit to add the dealer down
5. **Dealers are automatically grouped** - All downs for the same dealer appear under one card
6. **Tap any dealer card** to expand and see individual downs
7. Each dealer card shows:
   - Total tips (with unpaid amount if applicable)
   - Total rake
   - Grand total (tips + rake)
   - Number of downs
   - Payment status (All Paid, Partial, or Unpaid)
8. Each individual down within the expanded view shows:
   - Down number
   - Timestamp
   - Individual tips and rake amounts
   - Paid/unpaid status
   - **Mark Tips as Paid** button (if unpaid)
   - **Mark as Unpaid** button (if paid) - allows you to toggle back to unpaid
9. Edit any individual down by tapping the blue edit icon
10. Paid/unpaid status is tracked per down and rolled up to show overall dealer status

### Recording Expenses
1. Navigate to the Expenses tab
2. Tap the "+" button
3. Enter description, amount, and category
4. Add optional notes
5. Submit to log the expense
6. Tap the blue edit icon on any expense to edit or delete it

### Viewing Summary
The Dashboard tab provides a real-time overview of:
- **Till Balance**: Physical cash in the till (cash buy-ins - cashouts - paid tips - expenses)
- **House Profit**: Business profit (paid rake - expenses)
- Buy-in payment breakdown (cash in till, electronic, credit owed)
- Total buy-ins and cashouts
- Total tips and rake collected (including unpaid)
- Total expenses
- Number of unique players

**Important**: Tips and rake are only included in Till Balance and House Profit calculations once marked as paid. This ensures accurate tracking of actual cash on hand.

### Viewing Game History
Access your past saved games:
1. Navigate to the History tab
2. View all previously ended games sorted by most recent
3. Tap any game to expand and see:
   - Net profit/loss
   - Number of players
   - Total buy-ins, cashouts, tips, rake, and expenses
   - Transaction, dealer down, and expense counts
4. Delete any saved game permanently by tapping "Delete Game" in the expanded view

## Recent Updates

### Enhanced Error Handling & Logging (Dec 4, 2024)
Improved error handling and debugging for dealer down operations:
- **Better 502 error handling**: 502 Bad Gateway errors now classified as NETWORK_ERROR instead of SERVER_ERROR
- **Enhanced logging**: Added detailed console logs throughout the dealer down submission flow
- **Better user feedback**: More specific error messages and validation alerts
- **Session validation**: Improved session ID validation with clearer error messages
- **Mutation logging**: Added detailed logging to track mutation lifecycle (called, successful, failed)
- **Error details**: Error messages now include full details for easier debugging
- These improvements help identify whether errors are due to network/proxy issues or actual app bugs

### Backend Error Handling Improvement (Dec 4, 2024)
Enhanced backend error handling to provide better debugging information:
- **Global error handler**: Added comprehensive error handler to Hono app that logs errors and returns proper JSON responses
- **Dealer down validation**: Added session validation to prevent 502 errors when game session doesn't exist
- **Better error messages**: Backend now returns specific error messages (e.g., "Game session not found") instead of generic "Internal Server Error"
- **Improved debugging**: All errors are now logged with full stack traces in development mode
- **Frontend compatibility**: Error handling integrates with existing ApiError class for user-friendly error messages

### Button Reliability Fix (Dec 3, 2024)
Fixed a critical issue where input buttons (Player Buy-in, Dealer Down, etc.) would stop working during live game tracking:
- **Root cause**: Session ID could become stale/undefined, causing all mutations to silently fail
- **Fixed session handling**: All screens now use safe optional chaining (`gameData?.session?.id`) instead of unsafe access
- **Added session recovery**: When session is missing, the app now automatically refetches it before submitting data
- **Enhanced QueryClient**: Added global retry logic with exponential backoff for all queries and mutations
- **Better error handling**: All mutations now show clear error alerts when operations fail
- **Improved reliability**: Added `refetchOnReconnect` to automatically refresh data after network reconnection
- Screens affected: PlayersScreen, DealersScreen, ExpensesScreen, DashboardScreen

### Separate Tips and Rake Tracking (Dec 2, 2024)
Major improvement to dealer management - tips and rake are now tracked independently:
- **Separate tabs**: "Pay Dealers" for tips and "Claim Rake" for house rake
- Paying dealer tips no longer automatically marks rake as claimed
- New `rakeClaimed` field in database for independent tracking
- New API endpoints: `/claim-rake` and `/unclaim-rake`
- House profit now calculated from claimed rake only (not from paid tips)
- Amber-colored "Pay Dealers" tab with tip tracking
- Purple-colored "Claim Rake" tab with rake tracking
- Each tab shows appropriate totals (paid/unpaid for tips, claimed/unclaimed for rake)

### Database Schema Fix - Round 2 (Dec 2, 2024)
Fixed recurring database schema synchronization issue:
- Database schema was out of sync again with the `tableName` column missing
- Ran `bunx prisma db push` to synchronize database with Prisma schema
- Regenerated Prisma Client with updated schema
- Backend server automatically hot-reloaded with the fix
- App is now working properly - buy-in tab and all features functional

### Dealer Payment Toggle (Dec 1, 2024)
Added ability to toggle dealer tips between paid and unpaid status:
- New "Mark as Unpaid" button appears for paid dealer downs
- Allows you to correct payment status if tips were marked as paid by mistake
- Backend endpoint `/api/dealers/down/:id/unpay` handles the toggle
- Till Balance and House Profit calculations update immediately when toggling payment status

### Dealer Grouping Feature (Dec 1, 2024)
Redesigned the Dealers screen to group all dealer downs by dealer name:
- All downs for each dealer are now consolidated under one expandable card
- Shows total tips, total rake, and grand total for each dealer
- Displays payment status at a glance (All Paid, Partial, Unpaid)
- Tap any dealer card to expand and see individual downs
- Each individual down can still be edited or marked as paid independently
- Cleaner, more organized view when tracking multiple dealer downs throughout the night

### Database Schema Fix (Dec 1, 2024)
Fixed critical database schema synchronization issue that was preventing the app from accepting new information:
- Used `prisma db push` to synchronize the database schema with Prisma models
- Applied missing `tableName` and `tipsPaid` columns to database tables
- Regenerated Prisma Client to ensure type safety
- Pulled database schema to verify synchronization with `prisma db pull`
- Backend server automatically reloaded with updated schema

## Troubleshooting

### Database Issues
If you encounter errors related to missing database columns, the database migrations have been applied and the schema is now in sync.

## Notes

- All financial calculations are done in real-time
- Data persists across app sessions
- Pull down to refresh data on any screen
- Tap player names to expand and view detailed transaction history
- Edit or delete transactions by tapping the blue edit icon
- Payment methods are visually indicated with colored dots next to player names
- Authentication is optional but recommended for multi-user access
