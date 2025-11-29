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

### 💰 Player Tracking
- Log player buy-ins with multiple payment methods (cash, electronic, credit)
- Visual payment method indicators with colored dots (green=cash, blue=electronic, yellow=credit)
- Track cashouts
- View complete transaction history
- Edit or delete transactions with intuitive modal interface
- Add notes to transactions

### 🎲 Dealer Management
- Track dealer tips per down
- Log rake collected
- Editable text inputs for dealer name, tips, and rake amounts
- Edit dealer downs with blue edit icon
- Delete dealer downs from edit modal
- Mark tips as paid with one-tap button
- View paid/unpaid status with color-coded badges
- View dealer performance history
- Database fully supports paid/unpaid tip tracking

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
- **LoginModalScreen** (`src/screens/LoginModalScreen.tsx`) - Authentication

### Backend API Routes
- **Game Routes** (`/api/game/*`)
  - `GET /api/game/active` - Get or create active game session
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
5. Each dealer down shows as "Unpaid" by default
6. Tap "Mark Tips as Paid" button when you pay the dealer
7. Paid dealer downs show a green "Paid" badge
8. Only paid tips affect the Till Balance and House Profit calculations

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

## Notes

- All financial calculations are done in real-time
- Data persists across app sessions
- Pull down to refresh data on any screen
- Tap player names to expand and view detailed transaction history
- Edit or delete transactions by tapping the blue edit icon
- Payment methods are visually indicated with colored dots next to player names
- Authentication is optional but recommended for multi-user access
