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
import { Plus, X, Trash2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { api } from "@/lib/api";
import type { BottomTabScreenProps } from "@/navigation/types";
import type {
  GetActiveGameResponse,
  GetExpensesResponse,
  AddExpenseRequest,
  Expense,
} from "@/shared/contracts";

type Props = BottomTabScreenProps<"ExpensesTab">;

const ExpensesScreen = ({ navigation }: Props) => {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<"food" | "drinks" | "other">("food");
  const [notes, setNotes] = useState("");

  // Fetch active game session
  const { data: gameData } = useQuery({
    queryKey: ["activeGame"],
    queryFn: () => api.get<GetActiveGameResponse>("/api/game/active"),
  });

  const sessionId = gameData?.session.id;

  // Fetch expenses
  const { data: expensesData } = useQuery({
    queryKey: ["expenses", sessionId],
    queryFn: () => api.get<GetExpensesResponse>(`/api/expenses/${sessionId}`),
    enabled: !!sessionId,
  });

  // Add expense mutation
  const addExpenseMutation = useMutation({
    mutationFn: (data: AddExpenseRequest) => api.post("/api/expenses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      setModalVisible(false);
      resetForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setCategory("food");
    setNotes("");
  };

  const handleSubmit = () => {
    if (!description.trim() || !amount || !sessionId) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    addExpenseMutation.mutate({
      description: description.trim(),
      amount: numAmount,
      category,
      notes: notes.trim() || undefined,
      gameSessionId: sessionId,
    });
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const categoryColors: Record<string, string> = {
    food: "#10b981",
    drinks: "#3b82f6",
    other: "#8b5cf6",
  };

  const categoryEmoji: Record<string, string> = {
    food: "🍕",
    drinks: "🥤",
    other: "📦",
  };

  return (
    <View className="flex-1 bg-slate-950">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="p-4 gap-4">
          {expensesData?.expenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              onDelete={() => deleteExpenseMutation.mutate(expense.id)}
              formatCurrency={formatCurrency}
              formatTime={formatTime}
              categoryColors={categoryColors}
              categoryEmoji={categoryEmoji}
            />
          ))}
          {(!expensesData?.expenses || expensesData.expenses.length === 0) && (
            <View className="items-center justify-center py-12">
              <Text className="text-slate-500 text-center">No expenses yet</Text>
              <Text className="text-slate-600 text-center text-sm mt-1">
                Log comped food, drinks, and other expenses
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Button */}
      <Pressable
        onPress={() => {
          setModalVisible(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        className="absolute bottom-20 right-4 bg-violet-600 w-16 h-16 rounded-full items-center justify-center"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 4.65,
          elevation: 8,
        }}
      >
        <Plus size={32} color="#fff" />
      </Pressable>

      {/* Add Expense Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end"
        >
          <Pressable className="flex-1 bg-black/50" onPress={() => setModalVisible(false)} />
          <View className="bg-slate-900 rounded-t-3xl p-6 border-t border-slate-700">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-white text-2xl font-bold">Add Expense</Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                className="w-10 h-10 items-center justify-center"
              >
                <X size={24} color="#94a3b8" />
              </Pressable>
            </View>

            <View className="gap-4">
              <View>
                <Text className="text-slate-400 text-sm mb-2 font-medium">Description</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g., Pizza, Beer, Supplies"
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
                <Text className="text-slate-400 text-sm mb-2 font-medium">Category</Text>
                <View className="flex-row gap-2">
                  {(["food", "drinks", "other"] as const).map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => {
                        setCategory(cat);
                        Haptics.selectionAsync();
                      }}
                      className={`flex-1 py-3 rounded-lg border ${
                        category === cat
                          ? "bg-violet-600 border-violet-500"
                          : "bg-slate-800 border-slate-700"
                      }`}
                    >
                      <Text
                        className={`text-center font-medium capitalize ${
                          category === cat ? "text-white" : "text-slate-400"
                        }`}
                      >
                        {categoryEmoji[cat]} {cat}
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
                disabled={!description.trim() || !amount || addExpenseMutation.isPending}
                className={`bg-violet-600 py-4 rounded-lg mt-2 ${
                  (!description.trim() || !amount || addExpenseMutation.isPending) && "opacity-50"
                }`}
              >
                <Text className="text-white text-center font-bold text-lg">
                  {addExpenseMutation.isPending ? "Adding..." : "Add Expense"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const ExpenseCard = ({
  expense,
  onDelete,
  formatCurrency,
  formatTime,
  categoryColors,
  categoryEmoji,
}: {
  expense: Expense;
  onDelete: () => void;
  formatCurrency: (amount: number) => string;
  formatTime: (dateString: string) => string;
  categoryColors: Record<string, string>;
  categoryEmoji: Record<string, string>;
}) => {
  return (
    <View className="bg-slate-900 rounded-xl p-4 border border-slate-800">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="text-white text-lg font-bold">{expense.description}</Text>
          <Text className="text-slate-500 text-xs">{formatTime(expense.timestamp)}</Text>
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
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: `${categoryColors[expense.category]}20` }}
        >
          <Text
            className="text-xs font-medium capitalize"
            style={{ color: categoryColors[expense.category] }}
          >
            {categoryEmoji[expense.category]} {expense.category}
          </Text>
        </View>
        <Text className="text-red-400 text-2xl font-bold">{formatCurrency(expense.amount)}</Text>
      </View>

      {expense.notes && <Text className="text-slate-500 text-sm mt-2">{expense.notes}</Text>}
    </View>
  );
};

export default ExpensesScreen;
