import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, ChevronDown, ChevronRight, Trash2, DollarSign, Pencil } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { api, ApiError } from "@/lib/api";
import type { BottomTabScreenProps } from "@/navigation/types";
import type {
  GetActiveGameResponse,
  GetPlayerTransactionsResponse,
  AddPlayerTransactionRequest,
  PlayerTransaction,
} from "@/shared/contracts";

type Props = BottomTabScreenProps<"PlayersTab">;

// Player summary type
type PlayerSummary = {
  name: string;
  totalBuyIns: number;
  totalCashouts: number;
  netAmount: number;
  transactionCount: number;
  transactions: PlayerTransaction[];
};

const PlayersScreen = ({ navigation }: Props) => {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [transactionType, setTransactionType] = useState<"buy-in" | "cashout">("buy-in");
  const [playerName, setPlayerName] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "electronic" | "credit">("cash");
  const [notes, setNotes] = useState("");
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<PlayerTransaction | null>(null);

  // Fetch active game session - refetch frequently to prevent stale data
  const { data: gameData, refetch: refetchGame } = useQuery({
    queryKey: ["activeGame"],
    queryFn: () => api.get<GetActiveGameResponse>("/api/game/active"),
    retry: 3,
    staleTime: 30000, // Consider data stale after 30 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Safe session ID extraction with null check
  const sessionId = gameData?.session?.id;

  // Fetch player transactions
  const { data: transactionsData } = useQuery({
    queryKey: ["playerTransactions", sessionId],
    queryFn: () => api.get<GetPlayerTransactionsResponse>(`/api/players/transactions/${sessionId}`),
    enabled: !!sessionId,
    staleTime: 10000, // Refetch transactions more frequently
  });

  // Add transaction mutation
  const addTransactionMutation = useMutation({
    mutationFn: (data: AddPlayerTransactionRequest) =>
      api.post("/api/players/transaction", data),
    onSuccess: () => {
      console.log("[Players] Transaction added successfully");
      queryClient.invalidateQueries({ queryKey: ["playerTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      setModalVisible(false);
      resetForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof ApiError
        ? error.getUserMessage()
        : "Failed to add transaction. Please try again.";
      console.error("[Players] Error adding transaction:", errorMessage);
      Alert.alert("Error", errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  // Delete transaction mutation
  const deleteTransactionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/players/transaction/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      setEditModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Update transaction mutation
  const updateTransactionMutation = useMutation({
    mutationFn: (data: { id: string; amount: number; paymentMethod: "cash" | "electronic" | "credit"; notes?: string }) =>
      api.put(`/api/players/transaction/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      setEditModalVisible(false);
      setEditingTransaction(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Group transactions by player
  const playerSummaries: PlayerSummary[] = React.useMemo(() => {
    if (!transactionsData?.transactions) return [];

    const playerMap = new Map<string, PlayerSummary>();

    transactionsData.transactions.forEach((transaction) => {
      const existing = playerMap.get(transaction.playerName);

      if (existing) {
        existing.transactions.push(transaction);
        existing.transactionCount++;
        if (transaction.type === "buy-in") {
          existing.totalBuyIns += transaction.amount;
        } else {
          existing.totalCashouts += transaction.amount;
        }
        existing.netAmount = existing.totalBuyIns - existing.totalCashouts;
      } else {
        playerMap.set(transaction.playerName, {
          name: transaction.playerName,
          totalBuyIns: transaction.type === "buy-in" ? transaction.amount : 0,
          totalCashouts: transaction.type === "cashout" ? transaction.amount : 0,
          netAmount:
            transaction.type === "buy-in" ? transaction.amount : -transaction.amount,
          transactionCount: 1,
          transactions: [transaction],
        });
      }
    });

    // Sort transactions within each player by timestamp (most recent first)
    playerMap.forEach((summary) => {
      summary.transactions.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    });

    // Convert to array and sort by name
    return Array.from(playerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [transactionsData]);

  const resetForm = () => {
    setPlayerName("");
    setAmount("");
    setPaymentMethod("cash");
    setNotes("");
  };

  const handlePlayerNameChange = (text: string) => {
    setPlayerName(text);
  };

  const handleSubmit = async () => {
    console.log("[Players] handleSubmit called", { playerName, amount, sessionId, transactionType });

    if (!playerName.trim()) {
      console.log("[Players] Submit blocked: no player name");
      Alert.alert("Missing Info", "Please enter a player name.");
      return;
    }
    if (!amount) {
      console.log("[Players] Submit blocked: no amount");
      Alert.alert("Missing Info", "Please enter an amount.");
      return;
    }

    // If no sessionId, try to refetch the game session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      console.log("[Players] No sessionId, attempting to refetch game session");
      try {
        const result = await refetchGame();
        currentSessionId = result.data?.session?.id;
      } catch (e) {
        console.error("[Players] Failed to refetch game session:", e);
      }
    }

    if (!currentSessionId) {
      console.log("[Players] Submit blocked: no sessionId after refetch");
      Alert.alert("Error", "No active game session. Please restart the app.");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      console.log("[Players] Submit blocked: invalid amount", numAmount);
      Alert.alert("Invalid Amount", "Please enter a valid positive number.");
      return;
    }

    console.log("[Players] Submitting transaction", { playerName: playerName.trim(), type: transactionType, amount: numAmount, paymentMethod });

    addTransactionMutation.mutate({
      playerName: playerName.trim(),
      type: transactionType,
      amount: numAmount,
      paymentMethod,
      notes: notes.trim() || undefined,
      gameSessionId: currentSessionId,
    });
  };

  const handleEditTransaction = (transaction: PlayerTransaction) => {
    setEditingTransaction(transaction);
    setAmount(transaction.amount.toString());
    setPaymentMethod(transaction.paymentMethod);
    setNotes(transaction.notes || "");
    setEditModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleUpdateTransaction = () => {
    if (!editingTransaction || !amount) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    updateTransactionMutation.mutate({
      id: editingTransaction.id,
      amount: numAmount,
      paymentMethod,
      notes: notes.trim() || undefined,
    });
  };

  const handleDeleteTransaction = () => {
    if (!editingTransaction) return;
    deleteTransactionMutation.mutate(editingTransaction.id);
  };

  const togglePlayerExpanded = (playerName: string) => {
    setExpandedPlayers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(playerName)) {
        newSet.delete(playerName);
      } else {
        newSet.add(playerName);
      }
      return newSet;
    });
    Haptics.selectionAsync();
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const paymentMethodColors: Record<string, string> = {
    cash: "#10b981",
    electronic: "#3b82f6",
    credit: "#f59e0b",
  };

  return (
    <View className="flex-1 bg-slate-950">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="p-4 gap-3">
          {playerSummaries.map((player) => (
            <PlayerCard
              key={player.name}
              player={player}
              isExpanded={expandedPlayers.has(player.name)}
              onToggle={() => togglePlayerExpanded(player.name)}
              onEditTransaction={handleEditTransaction}
              formatCurrency={formatCurrency}
              formatTime={formatTime}
              formatDate={formatDate}
              paymentMethodColors={paymentMethodColors}
            />
          ))}
          {playerSummaries.length === 0 && (
            <View className="items-center justify-center py-12">
              <Text className="text-slate-500 text-center">No players yet</Text>
              <Text className="text-slate-600 text-center text-sm mt-1">
                Add a buy-in or cashout to get started
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Button */}
      <View className="absolute bottom-28 right-4 flex-row gap-2">
        <Pressable
          onPress={() => {
            console.log("[Players] Cash-out button pressed");
            setTransactionType("cashout");
            setModalVisible(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          className="bg-red-600 w-14 h-14 rounded-full items-center justify-center"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 4.65,
            elevation: 8,
          }}
        >
          <DollarSign size={24} color="#fff" />
          <Text className="text-white text-[10px] font-bold">OUT</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            console.log("[Players] Buy-in button pressed");
            setTransactionType("buy-in");
            setModalVisible(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          className="bg-emerald-600 w-14 h-14 rounded-full items-center justify-center"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 4.65,
            elevation: 8,
          }}
        >
          <Plus size={28} color="#fff" />
        </Pressable>
      </View>

      {/* Add Transaction Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end"
        >
          <Pressable className="flex-1 bg-black/50" onPress={() => setModalVisible(false)} />
          <View className="bg-slate-900 rounded-t-3xl p-6 border-t border-slate-700">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-white text-2xl font-bold">
                {transactionType === "buy-in" ? "Buy-in" : "Cashout"}
              </Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                className="w-10 h-10 items-center justify-center"
              >
                <X size={24} color="#94a3b8" />
              </Pressable>
            </View>

            <View className="gap-4">
              <View>
                <Text className="text-slate-400 text-sm mb-2 font-medium">Player Name</Text>
                <TextInput
                  value={playerName}
                  onChangeText={handlePlayerNameChange}
                  placeholder="Enter player name"
                  placeholderTextColor="#475569"
                  autoCapitalize="words"
                  autoCorrect={false}
                  className="bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700"
                  style={{ minHeight: 48 }}
                />
              </View>

              <View>
                <Text className="text-slate-400 text-sm mb-2 font-medium">Amount</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor="#475569"
                  keyboardType="decimal-pad"
                  className="bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700"
                  style={{ minHeight: 48 }}
                />
              </View>

              <View>
                <Text className="text-slate-400 text-sm mb-2 font-medium">Payment Method</Text>
                <View className="flex-row gap-2">
                  {(["cash", "electronic", "credit"] as const).map((method) => (
                    <Pressable
                      key={method}
                      onPress={() => {
                        setPaymentMethod(method);
                        Haptics.selectionAsync();
                      }}
                      className={`flex-1 py-3 rounded-lg border ${
                        paymentMethod === method
                          ? "bg-emerald-600 border-emerald-500"
                          : "bg-slate-800 border-slate-700"
                      }`}
                    >
                      <Text
                        className={`text-center font-medium capitalize ${
                          paymentMethod === method ? "text-white" : "text-slate-400"
                        }`}
                      >
                        {method}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View>
                <Text className="text-slate-400 text-sm mb-2 font-medium">Notes (Optional)</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add notes..."
                  placeholderTextColor="#475569"
                  multiline
                  numberOfLines={2}
                  className="bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700"
                />
              </View>

              <Pressable
                onPress={() => {
                  console.log("[Players] Submit button pressed");
                  handleSubmit();
                }}
                disabled={!playerName.trim() || !amount || addTransactionMutation.isPending}
                className={`py-4 rounded-lg mt-2 ${
                  transactionType === "buy-in" ? "bg-emerald-600" : "bg-red-600"
                } ${
                  (!playerName.trim() || !amount || addTransactionMutation.isPending) &&
                  "opacity-50"
                }`}
                style={{ marginBottom: 20 }}
              >
                <Text className="text-white text-center font-bold text-lg">
                  {addTransactionMutation.isPending ? "Adding..." : `Add ${transactionType}`}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end"
        >
          <Pressable className="flex-1 bg-black/50" onPress={() => setEditModalVisible(false)} />
          <View className="bg-slate-900 rounded-t-3xl p-6 border-t border-slate-700">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-white text-2xl font-bold">Edit Transaction</Text>
              <Pressable
                onPress={() => setEditModalVisible(false)}
                className="w-10 h-10 items-center justify-center"
              >
                <X size={24} color="#94a3b8" />
              </Pressable>
            </View>

            <View className="gap-4">
              {editingTransaction && (
                <>
                  <View className="bg-slate-800 rounded-lg p-3 mb-2">
                    <Text className="text-slate-400 text-xs mb-1">Player</Text>
                    <Text className="text-white text-lg font-bold">
                      {editingTransaction.playerName}
                    </Text>
                    <Text className="text-slate-400 text-xs mt-2">Type</Text>
                    <View
                      className="px-2 py-1 rounded self-start mt-1"
                      style={{
                        backgroundColor:
                          editingTransaction.type === "buy-in"
                            ? "rgba(16, 185, 129, 0.2)"
                            : "rgba(239, 68, 68, 0.2)",
                      }}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          editingTransaction.type === "buy-in" ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {editingTransaction.type.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View>
                    <Text className="text-slate-400 text-sm mb-2 font-medium">Amount</Text>
                    <TextInput
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="0.00"
                      placeholderTextColor="#475569"
                      keyboardType="decimal-pad"
                      className="bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700"
                    />
                  </View>

                  <View>
                    <Text className="text-slate-400 text-sm mb-2 font-medium">Payment Method</Text>
                    <View className="flex-row gap-2">
                      {(["cash", "electronic", "credit"] as const).map((method) => (
                        <Pressable
                          key={method}
                          onPress={() => {
                            setPaymentMethod(method);
                            Haptics.selectionAsync();
                          }}
                          className={`flex-1 py-3 rounded-lg border ${
                            paymentMethod === method
                              ? "bg-blue-600 border-blue-500"
                              : "bg-slate-800 border-slate-700"
                          }`}
                        >
                          <Text
                            className={`text-center font-medium capitalize ${
                              paymentMethod === method ? "text-white" : "text-slate-400"
                            }`}
                          >
                            {method}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text className="text-slate-400 text-sm mb-2 font-medium">
                      Notes (Optional)
                    </Text>
                    <TextInput
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Add notes..."
                      placeholderTextColor="#475569"
                      multiline
                      numberOfLines={2}
                      className="bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700"
                    />
                  </View>

                  <Pressable
                    onPress={handleUpdateTransaction}
                    disabled={!amount || updateTransactionMutation.isPending}
                    className={`py-4 rounded-lg bg-blue-600 ${
                      (!amount || updateTransactionMutation.isPending) && "opacity-50"
                    }`}
                  >
                    <Text className="text-white text-center font-bold text-lg">
                      {updateTransactionMutation.isPending ? "Updating..." : "Update Transaction"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleDeleteTransaction}
                    disabled={deleteTransactionMutation.isPending}
                    className={`py-4 rounded-lg bg-red-600 ${
                      deleteTransactionMutation.isPending && "opacity-50"
                    }`}
                  >
                    <Text className="text-white text-center font-bold text-lg">
                      {deleteTransactionMutation.isPending ? "Deleting..." : "Delete Transaction"}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// Player Card Component with expandable details
const PlayerCard = ({
  player,
  isExpanded,
  onToggle,
  onEditTransaction,
  formatCurrency,
  formatTime,
  formatDate,
  paymentMethodColors,
}: {
  player: PlayerSummary;
  isExpanded: boolean;
  onToggle: () => void;
  onEditTransaction: (transaction: PlayerTransaction) => void;
  formatCurrency: (amount: number) => string;
  formatTime: (dateString: string) => string;
  formatDate: (dateString: string) => string;
  paymentMethodColors: Record<string, string>;
}) => {
  // Get unique payment methods used by this player for buy-ins
  const paymentMethodsUsed = React.useMemo(() => {
    const methods = new Set<string>();
    player.transactions.forEach(t => {
      if (t.type === "buy-in") {
        methods.add(t.paymentMethod);
      }
    });
    return Array.from(methods);
  }, [player.transactions]);
  return (
    <View className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      {/* Player Summary (always visible) */}
      <Pressable onPress={onToggle} className="p-4">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2 flex-1">
            {isExpanded ? (
              <ChevronDown size={20} color="#94a3b8" />
            ) : (
              <ChevronRight size={20} color="#94a3b8" />
            )}
            <Text className="text-white text-xl font-bold">{player.name}</Text>
            {/* Payment method dots */}
            {paymentMethodsUsed.length > 0 && (
              <View className="flex-row gap-1 ml-2">
                {paymentMethodsUsed.map((method) => (
                  <View
                    key={method}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: paymentMethodColors[method] }}
                  />
                ))}
              </View>
            )}
          </View>
          <View className="items-end">
            <Text className="text-slate-400 text-xs mb-1">Net</Text>
            <Text
              className={`text-2xl font-bold ${
                player.netAmount >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatCurrency(Math.abs(player.netAmount))}
            </Text>
          </View>
        </View>

        {/* Summary Stats */}
        <View className="flex-row gap-2">
          <View className="flex-1 bg-slate-800 rounded-lg p-3">
            <Text className="text-slate-400 text-xs mb-1">Buy-ins</Text>
            <Text className="text-emerald-400 text-base font-bold">
              {formatCurrency(player.totalBuyIns)}
            </Text>
          </View>
          <View className="flex-1 bg-slate-800 rounded-lg p-3">
            <Text className="text-slate-400 text-xs mb-1">Cashouts</Text>
            <Text className="text-red-400 text-base font-bold">
              {formatCurrency(player.totalCashouts)}
            </Text>
          </View>
          <View className="flex-1 bg-slate-800 rounded-lg p-3">
            <Text className="text-slate-400 text-xs mb-1">Txns</Text>
            <Text className="text-blue-400 text-base font-bold">{player.transactionCount}</Text>
          </View>
        </View>
      </Pressable>

      {/* Transaction Details (expandable) */}
      {isExpanded && (
        <View className="border-t border-slate-800 bg-slate-950/50">
          {player.transactions.map((transaction, index) => (
            <View
              key={transaction.id}
              className={`px-4 py-3 ${
                index < player.transactions.length - 1 ? "border-b border-slate-800" : ""
              }`}
            >
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <View
                      className="px-2 py-1 rounded"
                      style={{
                        backgroundColor:
                          transaction.type === "buy-in"
                            ? "rgba(16, 185, 129, 0.2)"
                            : "rgba(239, 68, 68, 0.2)",
                      }}
                    >
                      <Text
                        className={`text-[10px] font-bold ${
                          transaction.type === "buy-in" ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {transaction.type.toUpperCase()}
                      </Text>
                    </View>
                    <View
                      className="px-2 py-1 rounded"
                      style={{
                        backgroundColor: `${paymentMethodColors[transaction.paymentMethod]}20`,
                      }}
                    >
                      <Text
                        className="text-[10px] font-medium capitalize"
                        style={{ color: paymentMethodColors[transaction.paymentMethod] }}
                      >
                        {transaction.paymentMethod}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-slate-500 text-xs">
                    {formatDate(transaction.timestamp)} • {formatTime(transaction.timestamp)}
                    {transaction.createdByInitials && ` • ${transaction.createdByInitials}`}
                  </Text>
                  {transaction.notes && (
                    <Text className="text-slate-500 text-xs mt-1">{transaction.notes}</Text>
                  )}
                </View>
                <View className="flex-row items-center gap-2">
                  <Text
                    className={`text-lg font-bold ${
                      transaction.type === "buy-in" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {formatCurrency(transaction.amount)}
                  </Text>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onEditTransaction(transaction);
                    }}
                    className="p-1"
                  >
                    <Pencil size={16} color="#3b82f6" />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default PlayersScreen;
