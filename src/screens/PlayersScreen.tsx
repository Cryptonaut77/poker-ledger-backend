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
  AddPlayerTransactionResponse,
  PlayerTransaction,
} from "@/shared/contracts";

type Props = BottomTabScreenProps<"PlayersTab">;

// Player summary type
type PlayerSummary = {
  name: string;
  totalBuyIns: number;
  totalCashouts: number;
  netAmount: number;
  creditBalance: number; // Amount owed by player (from credit buy-ins)
  iouBalance: number; // Amount owed to player (from IOU cashouts)
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

  // Mark transaction as paid mutation
  const markPaidMutation = useMutation({
    mutationFn: (id: string) => api.put(`/api/players/transaction/${id}/mark-paid`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof ApiError
        ? error.getUserMessage()
        : "Failed to mark transaction as paid.";
      Alert.alert("Error", errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  // Mark transaction as unpaid mutation
  const markUnpaidMutation = useMutation({
    mutationFn: (id: string) => api.put(`/api/players/transaction/${id}/mark-unpaid`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      const errorMessage = error instanceof ApiError
        ? error.getUserMessage()
        : "Failed to mark transaction as unpaid.";
      Alert.alert("Error", errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
          // Track unpaid credit buy-ins (player owes house)
          if (transaction.paymentMethod === "credit" && !transaction.isPaid) {
            existing.creditBalance += transaction.amount;
          }
        } else {
          existing.totalCashouts += transaction.amount;
          // Track unpaid IOU cashouts (house owes player)
          if (transaction.paymentMethod === "credit" && !transaction.isPaid) {
            existing.iouBalance += transaction.amount;
          }
        }
        existing.netAmount = existing.totalBuyIns - existing.totalCashouts;
      } else {
        let initialCredit = 0;
        let initialIou = 0;

        if (transaction.type === "buy-in" && transaction.paymentMethod === "credit" && !transaction.isPaid) {
          initialCredit = transaction.amount;
        } else if (transaction.type === "cashout" && transaction.paymentMethod === "credit" && !transaction.isPaid) {
          initialIou = transaction.amount;
        }

        playerMap.set(transaction.playerName, {
          name: transaction.playerName,
          totalBuyIns: transaction.type === "buy-in" ? transaction.amount : 0,
          totalCashouts: transaction.type === "cashout" ? transaction.amount : 0,
          netAmount:
            transaction.type === "buy-in" ? transaction.amount : -transaction.amount,
          creditBalance: initialCredit,
          iouBalance: initialIou,
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

    // Handle credit buy-ins that need to be marked as unpaid initially
    if (transactionType === "buy-in" && paymentMethod === "credit") {
      // Credit buy-ins should be marked as unpaid initially (they owe this money)
      console.log("[Players] Submitting unpaid credit buy-in", { playerName: playerName.trim(), amount: numAmount });

      try {
        const response = await api.post<AddPlayerTransactionResponse>("/api/players/transaction", {
          playerName: playerName.trim(),
          type: transactionType,
          amount: numAmount,
          paymentMethod,
          notes: notes.trim() || undefined,
          gameSessionId: currentSessionId,
        });

        // Mark it as unpaid
        if (response?.transaction) {
          await api.put(`/api/players/transaction/${response.transaction.id}/mark-unpaid`, {});
        }

        queryClient.invalidateQueries({ queryKey: ["playerTransactions"] });
        queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
        setModalVisible(false);
        resetForm();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        const errorMessage = error instanceof ApiError
          ? error.getUserMessage()
          : "Failed to add credit buy-in.";
        console.error("[Players] Error with credit buy-in:", errorMessage);
        Alert.alert("Error", errorMessage);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } else if (transactionType === "cashout" && paymentMethod === "credit") {
      // IOU cashouts should be marked as unpaid initially (house owes this money)
      console.log("[Players] Submitting unpaid IOU cashout", { playerName: playerName.trim(), amount: numAmount });

      try {
        const response = await api.post<AddPlayerTransactionResponse>("/api/players/transaction", {
          playerName: playerName.trim(),
          type: transactionType,
          amount: numAmount,
          paymentMethod,
          notes: notes.trim() || undefined,
          gameSessionId: currentSessionId,
        });

        // Mark it as unpaid
        if (response?.transaction) {
          await api.put(`/api/players/transaction/${response.transaction.id}/mark-unpaid`, {});
        }

        queryClient.invalidateQueries({ queryKey: ["playerTransactions"] });
        queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
        setModalVisible(false);
        resetForm();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        const errorMessage = error instanceof ApiError
          ? error.getUserMessage()
          : "Failed to add IOU cashout.";
        console.error("[Players] Error with IOU cashout:", errorMessage);
        Alert.alert("Error", errorMessage);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } else if (transactionType === "cashout" && (paymentMethod === "cash" || paymentMethod === "electronic")) {
      // Check if player has outstanding credit that should be settled
      const player = playerSummaries.find(p => p.name.toLowerCase() === playerName.trim().toLowerCase());
      const playerCreditBalance = player?.creditBalance || 0;

      if (playerCreditBalance > 0) {
        // Handle credit settlement for cash/electronic cashouts when player has outstanding credit
        const creditToSettle = Math.min(numAmount, playerCreditBalance);
        const cashToPay = Math.max(0, numAmount - playerCreditBalance);

        console.log("[Players] Credit settlement cashout", {
          totalCashout: numAmount,
          creditSettled: creditToSettle,
          cashPaid: cashToPay,
          paymentMethod
        });

        try {
          // Find the unpaid credit buy-in(s) to mark as paid
          const unpaidCreditTransactions = transactionsData?.transactions.filter(
            t => t.playerName.toLowerCase() === playerName.trim().toLowerCase()
              && t.type === "buy-in"
              && t.paymentMethod === "credit"
              && !t.isPaid
          ) || [];

          // Mark credit buy-ins as paid up to the settlement amount
          let remainingToSettle = creditToSettle;
          for (const creditTx of unpaidCreditTransactions) {
            if (remainingToSettle <= 0) break;

            if (creditTx.amount <= remainingToSettle) {
              // Fully settle this credit transaction
              await api.put(`/api/players/transaction/${creditTx.id}/mark-paid`, {});
              remainingToSettle -= creditTx.amount;
            }
            // If partial settlement is needed, we keep it unpaid (they still owe the difference)
          }

          // Create cashout transaction for the cash/electronic portion paid out (if any)
          if (cashToPay > 0) {
            await api.post("/api/players/transaction", {
              playerName: playerName.trim(),
              type: "cashout",
              amount: cashToPay,
              paymentMethod: paymentMethod,
              notes: `Profit from $${numAmount.toFixed(2)} cashout (credit settled: $${creditToSettle.toFixed(2)})${notes.trim() ? `. ${notes.trim()}` : ''}`,
              gameSessionId: currentSessionId,
            });
          } else {
            // If entire cashout was covered by credit settlement, create a $0 record or just note it
            // Actually, if cashToPay is 0, we don't need a cashout transaction - the credit is just settled
            console.log("[Players] Entire cashout covered by credit settlement, no cash paid out");
          }

          // Refresh data
          queryClient.invalidateQueries({ queryKey: ["playerTransactions"] });
          queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
          setModalVisible(false);
          resetForm();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          const errorMessage = error instanceof ApiError
            ? error.getUserMessage()
            : "Failed to process cashout with credit settlement.";
          console.error("[Players] Error with credit settlement:", errorMessage);
          Alert.alert("Error", errorMessage);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } else {
        // Normal cash/electronic cashout (no credit to settle)
        console.log("[Players] Submitting normal cashout", { playerName: playerName.trim(), type: transactionType, amount: numAmount, paymentMethod });

        addTransactionMutation.mutate({
          playerName: playerName.trim(),
          type: transactionType,
          amount: numAmount,
          paymentMethod,
          notes: notes.trim() || undefined,
          gameSessionId: currentSessionId,
        });
      }
    } else {
      // Normal transaction (cash or electronic)
      console.log("[Players] Submitting transaction", { playerName: playerName.trim(), type: transactionType, amount: numAmount, paymentMethod });

      addTransactionMutation.mutate({
        playerName: playerName.trim(),
        type: transactionType,
        amount: numAmount,
        paymentMethod,
        notes: notes.trim() || undefined,
        gameSessionId: currentSessionId,
      });
    }
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
    cash: "#3b82f6",      // blue
    electronic: "#f59e0b", // yellow/amber
    credit: "#ef4444",     // red
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
              onMarkPaid={(id) => markPaidMutation.mutate(id)}
              onMarkUnpaid={(id) => markUnpaidMutation.mutate(id)}
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
      <View className="absolute bottom-28 left-0 right-0 flex-row gap-2 justify-center">
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
                        className={`text-center font-medium ${
                          paymentMethod === method ? "text-white" : "text-slate-400"
                        }`}
                      >
                        {method === "credit" ? (transactionType === "cashout" ? "IOU" : "Credit") : method === "electronic" ? "Electronic" : "Cash"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Credit Settlement Info for Cashouts */}
              {(() => {
                const player = playerSummaries.find(p => p.name.toLowerCase() === playerName.trim().toLowerCase());
                const creditBalance = player?.creditBalance || 0;
                const parsedAmount = parseFloat(amount) || 0;

                if (transactionType === "cashout" && paymentMethod !== "credit" && creditBalance > 0 && parsedAmount > 0) {
                  const cashToPay = Math.max(0, parsedAmount - creditBalance);
                  return (
                    <View className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
                      <Text className="text-amber-400 text-sm font-bold mb-2">Credit Settlement</Text>
                      <View className="gap-2">
                        <View className="flex-row justify-between">
                          <Text className="text-slate-300 text-sm">Cashout Amount:</Text>
                          <Text className="text-white text-sm font-semibold">${parsedAmount.toFixed(2)}</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-slate-300 text-sm">Credit Owed:</Text>
                          <Text className="text-amber-400 text-sm font-semibold">-${creditBalance.toFixed(2)}</Text>
                        </View>
                        <View className="border-t border-amber-700/30 my-1" />
                        <View className="flex-row justify-between">
                          <Text className="text-white text-sm font-bold">{paymentMethod === "cash" ? "Cash" : "Electronic"} to Pay:</Text>
                          <Text className="text-emerald-400 text-base font-bold">
                            ${cashToPay.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-slate-400 text-xs mt-2">
                        {parsedAmount <= creditBalance
                          ? "Credit will be reduced. No cash payment needed."
                          : "Credit will be cleared and remaining paid out."}
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}

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
                            className={`text-center font-medium ${
                              paymentMethod === method ? "text-white" : "text-slate-400"
                            }`}
                          >
                            {method === "credit" ? (editingTransaction?.type === "cashout" ? "IOU" : "Credit") : method === "electronic" ? "Electronic" : "Cash"}
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
  onMarkPaid,
  onMarkUnpaid,
  formatCurrency,
  formatTime,
  formatDate,
  paymentMethodColors,
}: {
  player: PlayerSummary;
  isExpanded: boolean;
  onToggle: () => void;
  onEditTransaction: (transaction: PlayerTransaction) => void;
  onMarkPaid: (id: string) => void;
  onMarkUnpaid: (id: string) => void;
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

  // Get the primary payment method (the one with highest buy-in total)
  const primaryPaymentMethod = React.useMemo(() => {
    const methodTotals: Record<string, number> = {};
    player.transactions.forEach(t => {
      if (t.type === "buy-in") {
        methodTotals[t.paymentMethod] = (methodTotals[t.paymentMethod] || 0) + t.amount;
      }
    });

    let maxMethod = "cash";
    let maxAmount = 0;
    Object.entries(methodTotals).forEach(([method, amount]) => {
      if (amount > maxAmount) {
        maxAmount = amount;
        maxMethod = method;
      }
    });
    return maxMethod;
  }, [player.transactions]);

  // Determine net color: green if player won (negative net), red if player lost (positive net)
  const isWinner = player.netAmount <= 0;
  const netColor = isWinner ? "#10b981" : "#ef4444"; // green for winners, red for losers

  // Check if player has unpaid credit (player owes house)
  const hasUnpaidCredit = player.creditBalance > 0;

  // Check if house owes player (unpaid IOU cashouts)
  const hasUnpaidIou = player.iouBalance > 0;

  // Check if player had credit transactions that are now all paid
  const hadCreditNowPaid = React.useMemo(() => {
    const hasCreditTransactions = player.transactions.some(
      t => t.paymentMethod === "credit"
    );
    const hasUnpaidCreditTx = player.transactions.some(
      t => t.paymentMethod === "credit" && !t.isPaid
    );
    return hasCreditTransactions && !hasUnpaidCreditTx && player.creditBalance === 0 && player.iouBalance === 0;
  }, [player.transactions, player.creditBalance, player.iouBalance]);

  // Function to mark all unpaid credit buy-ins as paid
  const handleMarkAllPaid = () => {
    const unpaidCreditTransactions = player.transactions.filter(
      t => t.type === "buy-in" && t.paymentMethod === "credit" && !t.isPaid
    );

    // Mark all unpaid credit buy-ins as paid
    unpaidCreditTransactions.forEach(tx => {
      onMarkPaid(tx.id);
    });
  };

  // Function to mark all unpaid IOU cashouts as paid
  const handleMarkAllIouPaid = () => {
    const unpaidIouTransactions = player.transactions.filter(
      t => t.type === "cashout" && t.paymentMethod === "credit" && !t.isPaid
    );

    // Mark all unpaid IOU cashouts as paid
    unpaidIouTransactions.forEach(tx => {
      onMarkPaid(tx.id);
    });
  };

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
            <View className="flex-row items-center gap-2">
              <Text
                className="text-2xl font-bold"
                style={{ color: netColor }}
              >
                {formatCurrency(Math.abs(player.netAmount))}
              </Text>
              {/* Show IOU badge when house owes player */}
              {hasUnpaidIou && (
                <View className="bg-red-600/20 px-2 py-1 rounded">
                  <Text className="text-red-400 text-[10px] font-bold">IOU</Text>
                </View>
              )}
              {/* Mark as Paid button when player owes house (has unpaid credit) */}
              {hasUnpaidCredit && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    handleMarkAllPaid();
                  }}
                  className="bg-emerald-600 px-2 py-1 rounded"
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                    elevation: 5,
                  }}
                >
                  <Text className="text-white text-[10px] font-bold">MARK PAID</Text>
                </Pressable>
              )}
            </View>
            {/* Show PAID badge when all credit transactions have been settled */}
            {hadCreditNowPaid && (
              <View className="bg-emerald-600/20 px-2 py-0.5 rounded mt-1">
                <Text className="text-emerald-400 text-[10px] font-bold">PAID</Text>
              </View>
            )}
          </View>
        </View>

        {/* Summary Stats */}
        <View className="flex-row gap-2">
          <View className="flex-1 bg-slate-800 rounded-lg p-3">
            <Text className="text-slate-400 text-xs mb-1">Buy-ins</Text>
            <Text className="text-blue-400 text-base font-bold">
              {formatCurrency(player.totalBuyIns)}
            </Text>
          </View>
          <View className="flex-1 bg-slate-800 rounded-lg p-3">
            <Text className="text-slate-400 text-xs mb-1">Cashouts</Text>
            <Text className={`text-base font-bold ${player.netAmount <= 0 ? "text-emerald-400" : "text-red-400"}`}>
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
          {player.transactions.map((transaction, index) => {
            // Determine color for transaction
            // Buy-ins are blue, cashouts are green (win) or red (loss)
            const isBuyIn = transaction.type === "buy-in";
            const isWin = player.netAmount <= 0; // Negative or zero net means player won or broke even

            const badgeBgColor = isBuyIn
              ? "rgba(59, 130, 246, 0.2)" // blue for buy-in
              : isWin
                ? "rgba(16, 185, 129, 0.2)" // green for win
                : "rgba(239, 68, 68, 0.2)"; // red for loss

            const textColorClass = isBuyIn
              ? "text-blue-400"
              : isWin
                ? "text-emerald-400"
                : "text-red-400";

            return (
            <View
              key={transaction.id}
              className={`px-4 py-3 ${
                index < player.transactions.length - 1 ? "border-b border-slate-800" : ""
              }`}
            >
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                    <View
                      className="px-2 py-1 rounded"
                      style={{
                        backgroundColor: badgeBgColor,
                      }}
                    >
                      <Text
                        className={`text-[10px] font-bold ${textColorClass}`}
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
                        className="text-[10px] font-medium"
                        style={{ color: paymentMethodColors[transaction.paymentMethod] }}
                      >
                        {transaction.paymentMethod === "credit" ? (transaction.type === "cashout" ? "IOU" : "Credit") : transaction.paymentMethod === "electronic" ? "Electronic" : "Cash"}
                      </Text>
                    </View>
                    {/* Show unpaid badge for credit transactions */}
                    {transaction.paymentMethod === "credit" && transaction.isPaid === false && (
                      <View
                        className="px-2 py-1 rounded"
                        style={{ backgroundColor: "rgba(245, 158, 11, 0.2)" }}
                      >
                        <Text className="text-[10px] font-bold text-amber-400">
                          UNPAID
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-slate-500 text-xs">
                    {formatDate(transaction.timestamp)} • {formatTime(transaction.timestamp)}
                    {transaction.createdByInitials && ` • ${transaction.createdByInitials}`}
                  </Text>
                  {transaction.notes && (
                    <Text className="text-slate-500 text-xs mt-1">{transaction.notes}</Text>
                  )}
                  {/* Mark as Paid button for unpaid credit BUY-IN transactions (player owes house) */}
                  {transaction.type === "buy-in" && transaction.paymentMethod === "credit" && transaction.isPaid === false && (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onMarkPaid(transaction.id);
                      }}
                      className="bg-emerald-600 px-3 py-1.5 rounded mt-2 self-start"
                    >
                      <Text className="text-white text-xs font-bold">Mark as Paid</Text>
                    </Pressable>
                  )}
                  {/* Mark as Unpaid button for paid credit BUY-IN transactions */}
                  {transaction.type === "buy-in" && transaction.paymentMethod === "credit" && transaction.isPaid === true && (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onMarkUnpaid(transaction.id);
                      }}
                      className="bg-amber-600 px-3 py-1.5 rounded mt-2 self-start"
                    >
                      <Text className="text-white text-xs font-bold">Mark as Unpaid</Text>
                    </Pressable>
                  )}
                  {/* Mark as Paid button for unpaid IOU CASHOUT transactions (house owes player) */}
                  {transaction.type === "cashout" && transaction.paymentMethod === "credit" && transaction.isPaid === false && (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onMarkPaid(transaction.id);
                      }}
                      className="bg-emerald-600 px-3 py-1.5 rounded mt-2 self-start"
                    >
                      <Text className="text-white text-xs font-bold">Mark as Paid</Text>
                    </Pressable>
                  )}
                  {/* Mark as Unpaid button for paid IOU CASHOUT transactions */}
                  {transaction.type === "cashout" && transaction.paymentMethod === "credit" && transaction.isPaid === true && (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        onMarkUnpaid(transaction.id);
                      }}
                      className="bg-amber-600 px-3 py-1.5 rounded mt-2 self-start"
                    >
                      <Text className="text-white text-xs font-bold">Mark as Unpaid</Text>
                    </Pressable>
                  )}
                </View>
                <View className="flex-row items-center gap-2">
                  <Text
                    className={`text-lg font-bold ${textColorClass}`}
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
          )})}
        </View>
      )}
    </View>
  );
};

export default PlayersScreen;
