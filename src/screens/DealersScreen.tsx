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
import { Plus, X, Trash2, CheckCircle, Circle } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { api } from "@/lib/api";
import type { BottomTabScreenProps } from "@/navigation/types";
import type {
  GetActiveGameResponse,
  GetDealerDownsResponse,
  AddDealerDownRequest,
  DealerDown,
  MarkDealerTipsPaidResponse,
} from "@/shared/contracts";

type Props = BottomTabScreenProps<"DealersTab">;

const DealersScreen = ({ navigation }: Props) => {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [dealerName, setDealerName] = useState("");
  const [tips, setTips] = useState("");
  const [rake, setRake] = useState("");

  // Fetch active game session
  const { data: gameData } = useQuery({
    queryKey: ["activeGame"],
    queryFn: () => api.get<GetActiveGameResponse>("/api/game/active"),
  });

  const sessionId = gameData?.session.id;

  // Fetch dealer downs
  const { data: downsData } = useQuery({
    queryKey: ["dealerDowns", sessionId],
    queryFn: () => api.get<GetDealerDownsResponse>(`/api/dealers/downs/${sessionId}`),
    enabled: !!sessionId,
  });

  // Add dealer down mutation
  const addDownMutation = useMutation({
    mutationFn: (data: AddDealerDownRequest) => api.post("/api/dealers/down", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealerDowns"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      setModalVisible(false);
      resetForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Delete dealer down mutation
  const deleteDownMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/dealers/down/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealerDowns"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Mark tips as paid mutation
  const markTipsPaidMutation = useMutation({
    mutationFn: (id: string) => api.put<MarkDealerTipsPaidResponse>(`/api/dealers/down/${id}/pay`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealerDowns"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const resetForm = () => {
    setDealerName("");
    setTips("");
    setRake("");
  };

  const handleSubmit = () => {
    if (!dealerName.trim() || !sessionId) return;

    const numTips = parseFloat(tips) || 0;
    const numRake = parseFloat(rake) || 0;

    if (numTips < 0 || numRake < 0) return;

    addDownMutation.mutate({
      dealerName: dealerName.trim(),
      tips: numTips,
      rake: numRake,
      gameSessionId: sessionId,
    });
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <View className="flex-1 bg-slate-950">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="p-4 gap-4">
          {downsData?.downs.map((down) => (
            <DealerDownCard
              key={down.id}
              down={down}
              onDelete={() => deleteDownMutation.mutate(down.id)}
              onMarkPaid={() => markTipsPaidMutation.mutate(down.id)}
              formatCurrency={formatCurrency}
              formatTime={formatTime}
            />
          ))}
          {(!downsData?.downs || downsData.downs.length === 0) && (
            <View className="items-center justify-center py-12">
              <Text className="text-slate-500 text-center">No dealer downs yet</Text>
              <Text className="text-slate-600 text-center text-sm mt-1">
                Log tips and rake for each dealer down
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
        className="absolute bottom-28 right-4 bg-amber-600 w-16 h-16 rounded-full items-center justify-center"
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

      {/* Add Dealer Down Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end"
        >
          <Pressable className="flex-1 bg-black/50" onPress={() => setModalVisible(false)} />
          <View className="bg-slate-900 rounded-t-3xl p-6 border-t border-slate-700">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-white text-2xl font-bold">Dealer Down</Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                className="w-10 h-10 items-center justify-center"
              >
                <X size={24} color="#94a3b8" />
              </Pressable>
            </View>

            <View className="gap-4">
              <View>
                <Text className="text-slate-400 text-sm mb-2 font-medium">Dealer Name</Text>
                <TextInput
                  value={dealerName}
                  onChangeText={setDealerName}
                  placeholder="Enter dealer name"
                  placeholderTextColor="#475569"
                  className="bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700"
                />
              </View>

              <View>
                <Text className="text-slate-400 text-sm mb-2 font-medium">Tips</Text>
                <TextInput
                  value={tips}
                  onChangeText={setTips}
                  placeholder="0.00"
                  placeholderTextColor="#475569"
                  keyboardType="decimal-pad"
                  className="bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700"
                />
              </View>

              <View>
                <Text className="text-slate-400 text-sm mb-2 font-medium">Rake</Text>
                <TextInput
                  value={rake}
                  onChangeText={setRake}
                  placeholder="0.00"
                  placeholderTextColor="#475569"
                  keyboardType="decimal-pad"
                  className="bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700"
                />
              </View>

              <Pressable
                onPress={handleSubmit}
                disabled={!dealerName.trim() || addDownMutation.isPending}
                className={`bg-amber-600 py-4 rounded-lg mt-2 ${
                  (!dealerName.trim() || addDownMutation.isPending) && "opacity-50"
                }`}
              >
                <Text className="text-white text-center font-bold text-lg">
                  {addDownMutation.isPending ? "Adding..." : "Add Down"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const DealerDownCard: React.FC<{
  down: DealerDown;
  onDelete: () => void;
  onMarkPaid: () => void;
  formatCurrency: (amount: number) => string;
  formatTime: (dateString: string) => string;
}> = ({ down, onDelete, onMarkPaid, formatCurrency, formatTime }) => {
  const total = down.tips + down.rake;

  return (
    <View className="bg-slate-900 rounded-xl p-4 border border-slate-800">
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="text-white text-lg font-bold">{down.dealerName}</Text>
            {down.tipsPaid ? (
              <View className="flex-row items-center gap-1 bg-emerald-900/30 px-2 py-1 rounded-md border border-emerald-700/50">
                <CheckCircle size={14} color="#10b981" />
                <Text className="text-emerald-400 text-xs font-medium">Paid</Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-1 bg-amber-900/30 px-2 py-1 rounded-md border border-amber-700/50">
                <Circle size={14} color="#f59e0b" />
                <Text className="text-amber-400 text-xs font-medium">Unpaid</Text>
              </View>
            )}
          </View>
          <Text className="text-slate-500 text-xs">{formatTime(down.timestamp)}</Text>
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

      <View className="flex-row gap-2 mb-3">
        <View className="flex-1 bg-slate-800 rounded-lg p-3">
          <Text className="text-slate-400 text-xs font-medium mb-1">Tips</Text>
          <Text className="text-amber-400 text-lg font-bold">{formatCurrency(down.tips)}</Text>
        </View>
        <View className="flex-1 bg-slate-800 rounded-lg p-3">
          <Text className="text-slate-400 text-xs font-medium mb-1">Rake</Text>
          <Text className="text-amber-400 text-lg font-bold">{formatCurrency(down.rake)}</Text>
        </View>
      </View>

      <View className="bg-amber-900/20 rounded-lg p-3 border border-amber-800/30 mb-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-amber-300 text-sm font-medium">Total</Text>
          <Text className="text-amber-300 text-xl font-bold">{formatCurrency(total)}</Text>
        </View>
      </View>

      {!down.tipsPaid && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onMarkPaid();
          }}
          className="bg-emerald-600 py-3 rounded-lg"
        >
          <Text className="text-white text-center font-bold">Mark Tips as Paid</Text>
        </Pressable>
      )}
    </View>
  );
};

export default DealersScreen;
