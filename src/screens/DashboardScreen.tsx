import React from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, Modal, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { TrendingUp, TrendingDown, DollarSign, Users, Dices, Receipt, Power, Trash2, PlusCircle, UserPlus, HelpCircle } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { api } from "@/lib/api";
import * as RevenueCat from "@/lib/revenuecatClient";
import type { BottomTabScreenProps } from "@/navigation/types";
import type { GetActiveGameResponse, GameSummary, GetPlayerTransactionsResponse } from "@/shared/contracts";
import { CurrencySelectionModal, type Currency } from "@/components/CurrencySelectionModal";
import { formatCurrency as formatCurrencyUtil } from "@/utils/currency";

type Props = BottomTabScreenProps<"DashboardTab">;

const DashboardScreen = ({ navigation }: Props) => {
  const queryClient = useQueryClient();
  const [manageModalVisible, setManageModalVisible] = React.useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = React.useState(false);
  const [selectedCurrency, setSelectedCurrency] = React.useState<string>("USD");

  // Fetch active game session - with retry and refetch options
  const { data: gameData, isLoading: isLoadingGame } = useQuery({
    queryKey: ["activeGame"],
    queryFn: () => api.get<GetActiveGameResponse>("/api/game/active"),
    retry: 3,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Check paywall conditions when game data loads or completedGames count changes
  React.useEffect(() => {
    if (!gameData) return;

    const checkPaywall = async () => {
      console.log(`[Paywall] Checking paywall eligibility - Completed games: ${gameData.userCompletedGames}`);

      // Only show paywall if user has completed at least 1 game
      if (gameData.userCompletedGames > 0) {
        // Check if user has premium entitlement
        const hasPremiumResult = await RevenueCat.hasEntitlement("premium");

        console.log(`[Paywall] Has premium result:`, hasPremiumResult);

        // If RevenueCat is not configured or user doesn't have premium, show paywall
        if (hasPremiumResult.ok && !hasPremiumResult.data) {
          console.log(`[Paywall] Showing paywall - User completed ${gameData.userCompletedGames} games and doesn't have premium`);
          navigation.navigate("PaywallScreen");
        } else if (!hasPremiumResult.ok && hasPremiumResult.reason === "not_configured") {
          // RevenueCat not configured, allow access (dev/test mode)
          console.log("[Paywall] RevenueCat not configured, allowing access");
        } else if (hasPremiumResult.ok && hasPremiumResult.data) {
          console.log("[Paywall] User has premium access");
        }
      } else {
        console.log("[Paywall] User on first game - no paywall needed");
      }
    };

    checkPaywall();
  }, [gameData?.userCompletedGames, navigation]);

  // Safe session ID extraction with null check
  const sessionId = gameData?.session?.id;

  // Fetch game summary with retry for network resilience
  const {
    data: summary,
    isLoading: isLoadingSummary,
    refetch,
    isRefetching,
    error: summaryError,
  } = useQuery({
    queryKey: ["gameSummary", sessionId],
    queryFn: () => api.get<GameSummary>(`/api/game/${sessionId}/summary`),
    enabled: !!sessionId,
    retry: (failureCount, error) => {
      // Don't retry on 404 errors (session not found)
      if (error && typeof error === "object" && "status" in error && error.status === 404) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    staleTime: 30000,
  });

  // Fetch player transactions to calculate payment method breakdown
  const { data: transactionsData } = useQuery({
    queryKey: ["playerTransactions", sessionId],
    queryFn: () => api.get<GetPlayerTransactionsResponse>(`/api/players/transactions/${sessionId}`),
    enabled: !!sessionId,
    retry: 5,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Calculate net balance by payment method (buy-ins minus cashouts)
  // This represents what's physically in each payment method bucket
  const paymentBreakdown = React.useMemo(() => {
    if (!transactionsData?.transactions) {
      return { cash: 0, electronic: 0, credit: 0 };
    }

    const buyIns = transactionsData.transactions.filter((t) => t.type === "buy-in");
    const cashouts = transactionsData.transactions.filter((t) => t.type === "cashout");

    // Helper function to extract actual payout from auto-settled cashout notes
    // Notes format: "Cashout $1000.00 (credit settled: $500.00, electronic paid: $500.00)"
    const getActualPayout = (transaction: typeof cashouts[0]): number => {
      if (transaction.notes) {
        // Check for auto-settlement pattern
        const match = transaction.notes.match(/(\w+) paid: \$(\d+(?:\.\d{2})?)\)/);
        if (match) {
          return parseFloat(match[2]);
        }
      }
      return transaction.amount;
    };

    // Cash buy-ins add to till
    const cashBuyIns = buyIns
      .filter((t) => t.paymentMethod === "cash")
      .reduce((sum, t) => sum + t.amount, 0);

    // Cash cashouts remove from till - use actual payout for auto-settled
    const cashCashouts = cashouts
      .filter((t) => t.paymentMethod === "cash")
      .reduce((sum, t) => sum + getActualPayout(t), 0);

    // PAID credit buy-ins add cash to till (player paid their debt in cash)
    const paidCreditBuyIns = buyIns
      .filter((t) => t.paymentMethod === "credit" && t.isPaid === true)
      .reduce((sum, t) => sum + t.amount, 0);

    // Cash balance = cash buy-ins + paid credit (cash received) - cash cashouts
    const cashBalance = cashBuyIns + paidCreditBuyIns - cashCashouts;

    // Electronic balance: Electronic buy-ins mean we receive electronic payment,
    // Electronic cashouts mean we owe electronic payment - use actual payout for auto-settled
    const electronicBuyIns = buyIns
      .filter((t) => t.paymentMethod === "electronic")
      .reduce((sum, t) => sum + t.amount, 0);
    const electronicCashouts = cashouts
      .filter((t) => t.paymentMethod === "electronic")
      .reduce((sum, t) => sum + getActualPayout(t), 0);
    const electronicBalance = electronicBuyIns - electronicCashouts;

    // Credit balance: Only count UNPAID credit buy-ins
    // When credit is marked as PAID, the cash goes to till, not credit
    const unpaidCreditBuyIns = buyIns
      .filter((t) => t.paymentMethod === "credit" && t.isPaid === false)
      .reduce((sum, t) => sum + t.amount, 0);
    const creditCashouts = cashouts
      .filter((t) => t.paymentMethod === "credit")
      .reduce((sum, t) => sum + t.amount, 0);

    // Credit owed = unpaid credit buy-ins minus credit cashouts
    // Can't be negative (if they cash out more than they owe, they don't owe anything)
    const creditBalance = Math.max(0, unpaidCreditBuyIns - creditCashouts);

    return {
      cash: cashBalance,
      electronic: electronicBalance,
      credit: creditBalance,
    };
  }, [transactionsData]);

  // Calculate total buy-ins by payment method
  const buyInBreakdown = React.useMemo(() => {
    if (!transactionsData?.transactions) {
      return { cash: 0, electronic: 0, credit: 0, total: 0 };
    }

    const buyIns = transactionsData.transactions.filter((t) => t.type === "buy-in");

    const cashBuyIns = buyIns
      .filter((t) => t.paymentMethod === "cash")
      .reduce((sum, t) => sum + t.amount, 0);

    const electronicBuyIns = buyIns
      .filter((t) => t.paymentMethod === "electronic")
      .reduce((sum, t) => sum + t.amount, 0);

    const creditBuyIns = buyIns
      .filter((t) => t.paymentMethod === "credit")
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      cash: cashBuyIns,
      electronic: electronicBuyIns,
      credit: creditBuyIns,
      total: cashBuyIns + electronicBuyIns + creditBuyIns,
    };
  }, [transactionsData]);

  // End game mutation
  const endGameMutation = useMutation({
    mutationFn: () => api.post("/api/game/end", { sessionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeGame"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      setManageModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Delete game mutation
  const deleteGameMutation = useMutation({
    mutationFn: () => api.delete(`/api/game/${sessionId}`),
    onMutate: async () => {
      // Cancel any outgoing queries for the session being deleted
      await queryClient.cancelQueries({ queryKey: ["gameSummary", sessionId] });
      await queryClient.cancelQueries({ queryKey: ["playerTransactions", sessionId] });
      await queryClient.cancelQueries({ queryKey: ["dealerDowns", sessionId] });
      await queryClient.cancelQueries({ queryKey: ["expenses", sessionId] });
    },
    onSuccess: () => {
      // Remove the deleted session's cached data
      queryClient.removeQueries({ queryKey: ["gameSummary", sessionId] });
      queryClient.removeQueries({ queryKey: ["playerTransactions", sessionId] });
      queryClient.removeQueries({ queryKey: ["dealerDowns", sessionId] });
      queryClient.removeQueries({ queryKey: ["expenses", sessionId] });
      // Invalidate to get fresh data
      queryClient.invalidateQueries({ queryKey: ["activeGame"] });
      setManageModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Start new game mutation
  const startNewGameMutation = useMutation({
    mutationFn: (currency: string) => api.post("/api/game/new", { currency }),
    onMutate: async () => {
      // Cancel any outgoing queries for the old session
      await queryClient.cancelQueries({ queryKey: ["gameSummary", sessionId] });
      await queryClient.cancelQueries({ queryKey: ["playerTransactions", sessionId] });
      await queryClient.cancelQueries({ queryKey: ["dealerDowns", sessionId] });
      await queryClient.cancelQueries({ queryKey: ["expenses", sessionId] });
    },
    onSuccess: () => {
      // Remove old session's cached data
      queryClient.removeQueries({ queryKey: ["gameSummary", sessionId] });
      queryClient.removeQueries({ queryKey: ["playerTransactions", sessionId] });
      queryClient.removeQueries({ queryKey: ["dealerDowns", sessionId] });
      queryClient.removeQueries({ queryKey: ["expenses", sessionId] });
      // Invalidate to get fresh data
      queryClient.invalidateQueries({ queryKey: ["activeGame"] });
      setManageModalVisible(false);
      setCurrencyModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Handle currency selection and start new game
  const handleStartNewGame = () => {
    console.log("[Currency] Opening currency selection modal");
    setManageModalVisible(false);
    setCurrencyModalVisible(true);
  };

  const handleCurrencySelect = (currency: Currency) => {
    console.log("[Currency] Currency selected:", currency.code);
    setSelectedCurrency(currency.code);
    startNewGameMutation.mutate(currency.code);
  };

  const isLoading = isLoadingGame || isLoadingSummary;
  const isRefreshing = isRefetching;

  // Get current game currency
  const gameCurrency = gameData?.session?.currency || "USD";

  // Format currency using the game's currency
  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, gameCurrency);
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center">
        <Text className="text-slate-400 text-lg">Loading game...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => refetch()} tintColor="#10b981" />
        }
      >
        {/* Header with gradient */}
        <LinearGradient
          colors={["#1a5742", "#0f172a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 24, paddingTop: 20 }}
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-white text-3xl font-bold">Poker Game</Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => {
                  navigation.navigate("HelpScreen");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className="bg-slate-700 p-2 rounded-lg"
              >
                <HelpCircle size={20} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => {
                  navigation.navigate("ShareGameScreen");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className="bg-blue-600 p-2 rounded-lg"
              >
                <UserPlus size={20} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => {
                  setManageModalVisible(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
                className="bg-slate-800 px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-semibold">Manage</Text>
              </Pressable>
            </View>
          </View>
          {summary?.session && (
            <View className="flex-row items-center gap-2">
              <View className="w-2 h-2 rounded-full bg-emerald-500" />
              <Text className="text-emerald-300 text-sm">
                Started {formatDate(summary.session.startedAt)}
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Net Profit Card */}
        <View className="mx-4 mt-4 mb-6">
          <LinearGradient
            colors={["#1e293b", "#0f172a"]}
            style={{
              padding: 24,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#334155",
            }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-slate-400 text-sm font-medium">Till Balance</Text>
              {summary && summary.tillBalance >= 0 ? (
                <TrendingUp size={20} color="#10b981" />
              ) : (
                <TrendingDown size={20} color="#ef4444" />
              )}
            </View>
            <Text
              className={`text-5xl font-bold ${
                summary && summary.tillBalance >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {summary ? formatCurrency(summary.tillBalance) : "$0.00"}
            </Text>
            <Text className="text-slate-500 text-xs mt-2">Cash Buy-ins - Cashouts - Paid Tips - Expenses</Text>
          </LinearGradient>
        </View>

        {/* House Profit Card */}
        <View className="mx-4 mb-6">
          <View
            className="bg-slate-900 p-4 rounded-xl border border-slate-800"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-slate-400 text-sm font-medium">House Profit</Text>
              <Text
                className={`text-2xl font-bold ${
                  summary && summary.netProfit >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {summary ? formatCurrency(summary.netProfit) : "$0.00"}
              </Text>
            </View>
            <Text className="text-slate-500 text-xs mt-1">Paid Rake - Expenses</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="px-4 gap-4">
          {/* Active Balances */}
          <View className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <Text className="text-white text-lg font-bold mb-4">Active Balances</Text>
            <View className="gap-3">
              <View className="flex-row items-center justify-between bg-slate-800 p-3 rounded-lg">
                <View className="flex-row items-center gap-2">
                  <View className="w-3 h-3 rounded-full bg-blue-500" />
                  <Text className="text-slate-300 font-medium">Cash (In Till)</Text>
                </View>
                <Text className="text-blue-400 text-xl font-bold">
                  {formatCurrency(paymentBreakdown.cash)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between bg-slate-800 p-3 rounded-lg">
                <View className="flex-row items-center gap-2">
                  <View className="w-3 h-3 rounded-full bg-amber-500" />
                  <Text className="text-slate-300 font-medium">Electronic</Text>
                </View>
                <Text className="text-amber-400 text-xl font-bold">
                  {formatCurrency(paymentBreakdown.electronic)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between bg-slate-800 p-3 rounded-lg">
                <View className="flex-row items-center gap-2">
                  <View className="w-3 h-3 rounded-full bg-red-500" />
                  <Text className="text-slate-300 font-medium">Credit (Owed)</Text>
                </View>
                <Text className="text-red-400 text-xl font-bold">
                  {formatCurrency(paymentBreakdown.credit)}
                </Text>
              </View>
            </View>
            <View className="mt-4 pt-4 border-t border-slate-700">
              <View className="flex-row items-center justify-between">
                <Text className="text-slate-400 font-medium">Net Balance (Buy-ins - Cashouts)</Text>
                <Text className="text-white text-2xl font-bold">
                  {summary ? formatCurrency(summary.totalBuyIns - summary.totalCashouts) : "$0.00"}
                </Text>
              </View>
            </View>
          </View>

          {/* Total Buy-ins Breakdown */}
          <View className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <Text className="text-white text-lg font-bold mb-4">Total Buy-ins by Payment Method</Text>
            <View className="gap-3">
              <View className="flex-row items-center justify-between bg-slate-800 p-3 rounded-lg">
                <View className="flex-row items-center gap-2">
                  <View className="w-3 h-3 rounded-full bg-blue-500" />
                  <Text className="text-slate-300 font-medium">Cash</Text>
                </View>
                <Text className="text-blue-400 text-xl font-bold">
                  {formatCurrency(buyInBreakdown.cash)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between bg-slate-800 p-3 rounded-lg">
                <View className="flex-row items-center gap-2">
                  <View className="w-3 h-3 rounded-full bg-amber-500" />
                  <Text className="text-slate-300 font-medium">Electronic</Text>
                </View>
                <Text className="text-amber-400 text-xl font-bold">
                  {formatCurrency(buyInBreakdown.electronic)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between bg-slate-800 p-3 rounded-lg">
                <View className="flex-row items-center gap-2">
                  <View className="w-3 h-3 rounded-full bg-red-500" />
                  <Text className="text-slate-300 font-medium">Credit</Text>
                </View>
                <Text className="text-red-400 text-xl font-bold">
                  {formatCurrency(buyInBreakdown.credit)}
                </Text>
              </View>
            </View>
            <View className="mt-4 pt-4 border-t border-slate-700">
              <View className="flex-row items-center justify-between">
                <Text className="text-slate-400 font-medium">Total Buy-ins</Text>
                <Text className="text-white text-2xl font-bold">
                  {formatCurrency(buyInBreakdown.total)}
                </Text>
              </View>
            </View>
          </View>

          {/* Row 1 */}
          <View className="flex-row gap-4">
            <StatCard
              icon={<DollarSign size={24} color="#ef4444" />}
              label="Cashouts"
              value={summary ? formatCurrency(summary.totalCashouts) : "$0.00"}
              bgColor="bg-slate-900"
            />
            <StatCard
              icon={<Users size={24} color="#3b82f6" />}
              label="Players"
              value={summary ? summary.playerCount.toString() : "0"}
              bgColor="bg-slate-900"
            />
          </View>

          {/* Row 2 */}
          <View className="flex-row gap-4">
            <StatCard
              icon={<Dices size={24} color="#f59e0b" />}
              label="Dealer Tips"
              value={summary ? formatCurrency(summary.totalTips) : "$0.00"}
              bgColor="bg-slate-900"
            />
            <StatCard
              icon={<Dices size={24} color="#f59e0b" />}
              label="Rake"
              value={summary ? formatCurrency(summary.totalRake) : "$0.00"}
              bgColor="bg-slate-900"
            />
          </View>

          {/* Row 3 */}
          <View className="flex-row gap-4">
            <StatCard
              icon={<Receipt size={24} color="#8b5cf6" />}
              label="Expenses"
              value={summary ? formatCurrency(summary.totalExpenses) : "$0.00"}
              bgColor="bg-slate-900"
            />
          </View>
        </View>
      </ScrollView>

      {/* Manage Game Modal */}
      <Modal visible={manageModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end">
          <Pressable
            className="flex-1 bg-black/50"
            onPress={() => setManageModalVisible(false)}
          />
          <View className="bg-slate-900 rounded-t-3xl p-6 border-t border-slate-700">
            <Text className="text-white text-2xl font-bold mb-6">Manage Game</Text>

            <View className="gap-3">
              {/* End & Save Game */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  endGameMutation.mutate();
                }}
                disabled={endGameMutation.isPending || !gameData?.session.isActive}
                className={`bg-blue-600 py-4 rounded-lg flex-row items-center justify-center gap-2 ${
                  (endGameMutation.isPending || !gameData?.session.isActive) && "opacity-50"
                }`}
              >
                <Power size={20} color="#fff" />
                <Text className="text-white text-center font-bold text-lg">
                  {endGameMutation.isPending ? "Ending Game..." : "End & Save Game"}
                </Text>
              </Pressable>

              {/* Start New Game */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleStartNewGame();
                }}
                disabled={startNewGameMutation.isPending}
                className={`bg-emerald-600 py-4 rounded-lg flex-row items-center justify-center gap-2 ${
                  startNewGameMutation.isPending && "opacity-50"
                }`}
              >
                <PlusCircle size={20} color="#fff" />
                <Text className="text-white text-center font-bold text-lg">
                  {startNewGameMutation.isPending ? "Starting..." : "Start New Game"}
                </Text>
              </Pressable>

              {/* Delete Game */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert(
                    "Delete Game",
                    "Are you sure you want to delete this game? All data will be permanently removed.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => deleteGameMutation.mutate(),
                      },
                    ]
                  );
                }}
                disabled={deleteGameMutation.isPending}
                className={`bg-red-600/20 border border-red-600 py-4 rounded-lg flex-row items-center justify-center gap-2 ${
                  deleteGameMutation.isPending && "opacity-50"
                }`}
              >
                <Trash2 size={20} color="#ef4444" />
                <Text className="text-red-500 text-center font-bold text-lg">
                  {deleteGameMutation.isPending ? "Deleting..." : "Delete Game"}
                </Text>
              </Pressable>

              {/* Cancel */}
              <Pressable
                onPress={() => setManageModalVisible(false)}
                className="py-4 rounded-lg"
              >
                <Text className="text-slate-400 text-center font-medium text-lg">Cancel</Text>
              </Pressable>
            </View>

            <View className="mt-4 p-4 bg-slate-800 rounded-lg">
              <Text className="text-slate-400 text-xs">
                <Text className="font-bold">End & Save:</Text> Marks game as complete for record keeping{"\n"}
                <Text className="font-bold">Start New:</Text> Ends current game and creates a fresh one{"\n"}
                <Text className="font-bold">Delete:</Text> Permanently removes all game data
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Currency Selection Modal */}
      <CurrencySelectionModal
        visible={currencyModalVisible}
        onClose={() => setCurrencyModalVisible(false)}
        onSelect={handleCurrencySelect}
        selectedCurrency={selectedCurrency}
      />
    </View>
  );
};

// Stat Card Component
const StatCard = ({
  icon,
  label,
  value,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bgColor: string;
}) => {
  return (
    <View
      className={`flex-1 ${bgColor} p-4 rounded-xl border border-slate-800`}
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      }}
    >
      <View className="flex-row items-center gap-2 mb-2">{icon}</View>
      <Text className="text-slate-400 text-xs font-medium mb-1">{label}</Text>
      <Text className="text-white text-xl font-bold">{value}</Text>
    </View>
  );
};

export default DashboardScreen;
