# Poker Night Ledger

A beautiful, sophisticated mobile app for managing home poker games. Track player buy-ins, cashouts, dealer tips, rake, and expenses all in one place.

## Features

### 💎 Premium Subscription
- **Free first game** - Try the full app experience with your first poker game
- **Premium required** - After your first completed game, subscribe to continue tracking unlimited games
- **Monthly plan**: $9.99/month
- **Yearly plan**: $96.99/year (save 19%)
- **RevenueCat powered** - Seamless subscription management and restoration
- **All features included** - Unlimited games, cloud sync, team collaboration, and priority support

### 🔐 User Authentication (Required)
- Email and password sign up/sign in
- Each user has their own private game data
- Secure session management with Better Auth
- Beautiful dark-themed login screen
- Account management with sign out capability
- **Remember email** - Option to save email for quick login

### 🔗 Team Collaboration (NEW!)
- **Share codes** - Generate a 6-character code to invite coworkers to your game
- **QR code sharing** - Display a scannable QR code for easy access to your game
- **Join games** - Enter a share code to join a game as an editor
- **Team members list** - View all members who have access to the game
- **User initials** - Every entry shows who created it (initials displayed)
- **Owner controls** - Only game owner can generate/revoke share codes
- **Remove members** - Owner can remove team members at any time
- **24-hour expiry** - Share codes expire after 24 hours for security

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
- Log cashouts with multiple payment methods (cash, electronic, IOU)
- Visual payment method indicators with colored dots (green=cash, blue=electronic, yellow=credit/IOU)
- **Context-aware labels**: Buy-ins show "Credit" while cashouts show "IOU" for the same payment method
- **Unpaid credit/IOU tracking**: Track money owed both ways
  - **Player owes house** (credit buy-ins): When players buy in on credit, credit balance tracks what they owe
  - **House owes player** (IOU cashouts): When players cash out on IOU, IOU balance tracks what house owes them
  - Visual "UNPAID" badge on credit/IOU transactions that haven't been paid
  - Visual "IOU" badge on net amount when house owes player money
  - Outstanding balances shown per player (only unpaid amounts)
  - "Mark as Paid" button to track when debts are settled (works for both credit buy-ins and IOU cashouts)
  - "Mark as Unpaid" button to toggle payment status if needed
  - When credit buy-in is marked as paid, cash goes into the till
  - When IOU cashout is marked as paid, that obligation is settled
  - Net balance calculation reflects actual money owed in both directions
  - **Smart credit settlement**: When a player with outstanding credit cashes out, the system automatically applies their cashout toward their credit balance
    - Cashout note shows exactly what was paid: `"paid $400 credit, owes $600, received $0 cash"`
    - If they cash out more than they owe: `"paid $500 credit, received $200 cash"` (they get the difference)
    - Till balance only increases when you manually mark the remaining credit as paid
    - Credit balance correctly reflects what's still owed after partial payments
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
- **Payment method selection**: Choose between Cash or Electronic when logging expenses
- Visual payment method indicators with colored dots (green=cash, blue=electronic)
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
- **ShareGameScreen** (`src/screens/ShareGameScreen.tsx`) - Team collaboration and QR code sharing

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

**Starting a new game:**
1. Navigate to the Dashboard tab
2. Tap "Manage" button
3. Tap "Start New Game"
4. Select your preferred currency from the list
5. New game starts with your chosen currency - all amounts will be formatted accordingly

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
4. Select payment method (Cash or Electronic)
5. Add optional notes
6. Submit to log the expense
7. Tap the blue edit icon on any expense to edit or delete it
8. Expense cards display both category and payment method badges

### Viewing Summary
The Dashboard tab provides a real-time overview of:
- **Till Balance**: Physical cash in the till (cash buy-ins + paid credit debts - cash cashouts - paid tips - expenses)
- **House Profit**: Business profit (claimed rake - expenses)
- **Payment Method Balances**: Net balance (buy-ins minus cashouts) for each payment method
  - Cash (In Till): Cash buy-ins + paid credit debts - cash cashouts
  - Electronic: Electronic buy-ins - electronic cashouts
  - Credit (Owed): Unpaid credit buy-ins - credit cashouts (never negative)
- Total net amount (total buy-ins - total cashouts)
- Total buy-ins and cashouts
- Total tips and rake collected (including unpaid)
- Total expenses
- Number of unique players

**Important**:
- Tips and rake are only included in Till Balance and House Profit calculations once marked as paid/claimed
- When a credit buy-in is marked as "Paid", that cash payment goes into the Till Balance
- IOU cashouts don't affect Till Balance (no cash paid out yet)

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

### IOU Cashout Tracking (Dec 10, 2024)
Fixed IOU cashout tracking to properly show when house owes players money:
- **Removed automatic credit settlement**: Credit and IOU transactions are now tracked independently
  - When a player cashes out, no automatic settlement happens
  - Credit buy-ins and IOU cashouts remain separate until manually marked as paid
- **Two-way tracking**: System tracks both directions of debt
  - `creditBalance`: Tracks money player owes house (from unpaid credit buy-ins)
  - `iouBalance`: Tracks money house owes player (from unpaid IOU cashouts)
- **IOU badge on net**: When house owes player money (unpaid IOU cashouts), net amount displays red "IOU" badge
- **Proper calculation**: Net amount correctly reflects the debt direction
  - Player buys in $500 credit, cashes out $1000 IOU → Net $500 shows IOU badge (house owes player)
  - Player buys in $500 credit, cashes out $300 cash → Net -$200 (player owes house $200)
- **Mark as Paid buttons**: Works for both credit buy-ins and IOU cashouts
- **Transaction list**: Both credit buy-ins and IOU cashouts show UNPAID badge and Mark as Paid buttons
- **No money in till from credit**: Credit buy-ins don't add money to till until marked as paid. IOU cashouts don't take money from till.
- **Example scenario**:
  - Player buys in $500 on credit (unpaid) → creditBalance: $500, till: $0
  - Player cashes out $1000 on IOU (unpaid) → iouBalance: $1000, net: $500 with IOU badge
  - House owes player $500 until IOU is marked as paid
  - No money moved in or out of till - all on credit

### Unpaid Credit Tracking (Dec 9, 2024)
Added comprehensive tracking for unpaid credit balances:
- **isPaid field**: New database field to track whether credit transactions have been paid back
- **Visual indicators**: Unpaid credit transactions display an amber "UNPAID" badge
- **Outstanding balance**: Player credit balance only includes unpaid amounts
- **Mark as Paid**: Button to mark credit transactions as paid when player settles debt
- **Mark as Unpaid**: Toggle button to mark transactions as unpaid if needed
- **Smart cashout handling**: When cashing out on credit/IOU, transaction is automatically marked as unpaid
- **Backend endpoints**: New `/mark-paid` and `/mark-unpaid` endpoints for toggling payment status
- **How it works**:
  - Player buys in $500 on credit → Shows $500 unpaid credit
  - Player cashes out $300 on IOU → Shows $200 ($500-$300) unpaid credit owed
  - Once paid, tap "Mark as Paid" → Credit balance updates to $0
  - Transaction history shows paid vs unpaid status clearly

### Help & Instructions (Dec 8, 2024)
Added comprehensive in-app help section:
- **Help button**: Question mark icon in the top right of the Dashboard
- **12 expandable sections**: Covering all major features and workflows
- **Getting Started guide**: Learn the basics of the app
- **Feature walkthroughs**: Step-by-step instructions for each feature
- **Tips & Best Practices**: Pro tips for running smooth poker games
- **Easy access**: Tap any section to expand and read detailed instructions

### Currency Selection (Dec 8, 2024)
Added ability to select local currency when starting a new game:
- **24 currencies supported**: USD, EUR, GBP, JPY, CNY, AUD, CAD, CHF, INR, MXN, BRL, ZAR, SGD, HKD, SEK, NOK, DKK, NZD, KRW, THB, AED, SAR, PLN, TRY
- **Currency modal**: Beautiful modal with searchable currency list when starting a new game
- **Proper formatting**: All amounts automatically formatted with correct currency symbol and decimals
- **Symbol positioning**: Respects currency conventions (e.g., "$100" for USD, "100 kr" for SEK)
- **Per-game currency**: Each game session stores and uses its own currency
- **Smart decimals**: Zero-decimal currencies like JPY and KRW display without cents
- **How it works**: Click "Start New Game" → Select currency → Game starts with your chosen currency

### Paywall Trigger Fix (Dec 8, 2024)
Fixed paywall not showing after completing first game:
- **Removed stale flag**: Removed `hasCheckedPaywall` flag that was preventing re-checks
- **Dynamic checking**: Paywall now re-checks whenever `userCompletedGames` count changes
- **Better logging**: Added detailed console logs to track paywall eligibility checks
- **How it works**: After ending your first game, the paywall will automatically appear when you navigate to the dashboard
- **Premium check**: System verifies RevenueCat premium entitlement on every completed game count change
- **Backend logging**: Added logging to track user's completed games count

### Payment Method Balance Fix (Dec 9, 2024)
Fixed dashboard payment breakdown and till balance calculation to properly handle paid credit debts:
- **Till Balance fix**: When credit buy-in is marked as PAID, that cash now correctly adds to Till Balance
- **Backend calculation**: `tillBalance = cashBuyIns + paidCreditBuyIns - cashCashouts - paidTips - expenses`
- **Frontend alignment**: Dashboard Cash (In Till) balance matches backend calculation
- **Net balances**: Dashboard shows net balance (buy-ins minus cashouts) for each payment method
- **Electronic cashouts**: When a player cashes out electronically, it correctly reduces the electronic balance
- **Cash cashouts**: Cash cashouts reduce the cash balance displayed
- **Credit shows only owed**: Credit balance only shows UNPAID credit buy-ins
- **Paid credit adds to cash**: When credit is marked as PAID, that cash goes into the Cash (In Till) balance
- **Updated labels**: Changed "Buy-in Payment Breakdown" to "Payment Method Balances" for clarity
- **Total net calculation**: Shows "Total Net (Buy-ins - Cashouts)" instead of just "Total Buy-ins"
- **Example scenarios**:
  - Player P buys in $500 credit (unpaid) → Till: $0, Credit: $500
  - Player P's credit marked as PAID → Till: $500, Credit: $0
  - Player O cashes out $1500 ($500 cash + $500 electronic + $500 from P's paid credit) → Till: $0
- **Help section updated**: Added detailed explanation of credit/IOU system and cashout payment methods

### QR Code Sharing (Dec 8, 2024)
Added QR code generation for easy game sharing:
- **QR Code button**: Toggle to display/hide a scannable QR code on the Share Game screen
- **Deep link integration**: QR codes contain a deep link that opens the app directly
- **Auto-fill code**: When scanned, the share code is automatically filled in the join form
- **Expo Go compatible**: Works with Expo Go app on both iOS and Android
- **Clean design**: QR code displays on a white background for optimal scanning
- **Easy toggle**: Tap "QR Code" button to show, tap "Hide QR" to dismiss
- Located in the Share Game screen alongside Copy and Share buttons
- **How it works**: Scan QR code → App opens → Join form appears with code pre-filled

### Centered Bottom Buttons (Dec 8, 2024)
Improved button positioning on Players screen:
- **Buy In and Cash Out buttons** now centered at bottom of screen
- Prevents overlap with edit icons when player list is full
- Better visual balance and accessibility

### Network Status Banner (Dec 6, 2024)
Added a visual indicator for connection issues:
- **Network status banner**: Shows when connection is interrupted
- **Retry button**: Manually retry connection when offline
- **Auto-hide**: Banner automatically hides when connection is restored
- **Data safety**: All data is safely stored in the cloud database - connection issues are temporary

### User Authentication Required (Dec 6, 2024)
Major security update - the app now requires user accounts:
- **Login required**: Users must sign in or create an account before accessing the app
- **Private data**: Each user's game sessions, transactions, and history are completely private
- **Database update**: GameSession model now links to User via userId field
- **Protected API routes**: All backend routes require authentication and verify data ownership
- **Improved login screen**: Beautiful dark-themed full-screen login experience
- **Account management**: View account info and sign out from the Account screen
- **Data isolation**: Users can only see and modify their own game data

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
