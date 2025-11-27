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
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Trash2, DollarSign } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { api } from "@/lib/api";
import type { BottomTabScreenProps } from "@/navigation/types";
import type {
  GetActiveGameResponse,
  GetPlayerTransactionsResponse,
  AddPlayerTransactionRequest,
  PlayerTransaction,
} from "@/shared/contracts";

type Props = BottomTabScreenProps<"PlayersTab">;

const PlayersScreen = ({ navigation }: Props) => {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [transactionType, setTransactionType] = useState<"buy-in" | "cashout">("buy-in");
  const [playerName, setPlayerName] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "electronic" | "credit">("cash");
  const [notes, setNotes] = useState("");

  // Fetch active game session
  const { data: gameData } = useQuery({
    queryKey: ["activeGame"],
    queryFn: () => api.get<GetActiveGameResponse>("/api/game/active"),
  });

  const sessionId = gameData?.session.id;

  // Fetch player transactions
  const { data: transactionsData } = useQuery({
    queryKey: ["playerTransactions", sessionId],
    queryFn: () => api.get<GetPlayerTransactionsResponse>(`/api/players/transactions/${sessionId}`),
    enabled: !!sessionId,
  });

  // Add transaction mutation
  const addTransactionMutation = useMutation({
    mutationFn: (data: AddPlayerTransactionRequest) =>
      api.post("/api/players/transaction", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      setModalVisible(false);
      resetForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Delete transaction mutation
  const deleteTransactionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/players/transaction/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const resetForm = () => {
    setPlayerName("");
    setAmount("");
    setPaymentMethod("cash");
    setNotes("");
  };

  const handleSubmit = () => {
    if (!playerName.trim() || !amount || !sessionId) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    addTransactionMutation.mutate({
      playerName: playerName.trim(),
      type: transactionType,
      amount: numAmount,
      paymentMethod,
      notes: notes.trim() || undefined,
      gameSessionId: sessionId,
    });
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const paymentMethodColors: Record<string, string> = {
    cash: "#10b981",
    electronic: "#3b82f6",
    credit: "#f59e0b",
  };

  return (
    <View className="flex-1 bg-slate-950">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="p-4 gap-4">
          {transactionsData?.transactions.map((transaction) => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction}
              onDelete={() => deleteTransactionMutation.mutate(transaction.id)}
              formatCurrency={formatCurrency}
              formatTime={formatTime}
              paymentMethodColors={paymentMethodColors}
            />
          ))}
          {(!transactionsData?.transactions || transactionsData.transactions.length === 0) && (
            <View className="items-center justify-center py-12">
              <Text className="text-slate-500 text-center">No transactions yet</Text>
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
                  onChangeText={setPlayerName}
                  placeholder="Enter player name"
                  placeholderTextColor="#475569"
                  className="bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700"
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
                onPress={handleSubmit}
                disabled={!playerName.trim() || !amount || addTransactionMutation.isPending}
                className={`py-4 rounded-lg mt-2 ${
                  transactionType === "buy-in" ? "bg-emerald-600" : "bg-red-600"
                } ${
                  (!playerName.trim() || !amount || addTransactionMutation.isPending) &&
                  "opacity-50"
                }`}
              >
                <Text className="text-white text-center font-bold text-lg">
                  {addTransactionMutation.isPending ? "Adding..." : `Add ${transactionType}`}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const TransactionCard = ({
  transaction,
  onDelete,
  formatCurrency,
  formatTime,
  paymentMethodColors,
}: {
  transaction: PlayerTransaction;
  onDelete: () => void;
  formatCurrency: (amount: number) => string;
  formatTime: (dateString: string) => string;
  paymentMethodColors: Record<string, string>;
}) => {
  return (
    <View className="bg-slate-900 rounded-xl p-4 border border-slate-800">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="text-white text-lg font-bold">{transaction.playerName}</Text>
          <Text className="text-slate-500 text-xs">{formatTime(transaction.timestamp)}</Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onDelete();
          }}
          className="p-2"
        >
          <Trash2 size={18} color="#ef4444" />
        </Pressable>
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View
            className="px-3 py-1 rounded-full"
            style={{
              backgroundColor:
                transaction.type === "buy-in"
                  ? "rgba(16, 185, 129, 0.2)"
                  : "rgba(239, 68, 68, 0.2)",
            }}
          >
            <Text
              className={`text-xs font-bold ${
                transaction.type === "buy-in" ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {transaction.type.toUpperCase()}
            </Text>
          </View>
          <View
            className="px-3 py-1 rounded-full"
            style={{
              backgroundColor: `${paymentMethodColors[transaction.paymentMethod]}20`,
            }}
          >
            <Text
              className="text-xs font-medium capitalize"
              style={{ color: paymentMethodColors[transaction.paymentMethod] }}
            >
              {transaction.paymentMethod}
            </Text>
          </View>
        </View>
        <Text
          className={`text-2xl font-bold ${
            transaction.type === "buy-in" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {formatCurrency(transaction.amount)}
        </Text>
      </View>

      {transaction.notes && (
        <Text className="text-slate-500 text-sm mt-2">{transaction.notes}</Text>
      )}
    </View>
  );
};

export default PlayersScreen;
