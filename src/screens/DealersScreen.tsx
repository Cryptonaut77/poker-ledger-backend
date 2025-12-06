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
import { Plus, X, Trash2, CheckCircle, Circle, Edit3, ChevronDown, ChevronRight, DollarSign, Wallet } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { api, ApiError } from "@/lib/api";
import type { BottomTabScreenProps } from "@/navigation/types";
import type {
  GetActiveGameResponse,
  GetDealerDownsResponse,
  AddDealerDownRequest,
  UpdateDealerDownRequest,
  DealerDown,
  MarkDealerTipsPaidResponse,
} from "@/shared/contracts";

type Props = BottomTabScreenProps<"DealersTab">;
type TabType = "tips" | "rake";

// Component for grouped dealer cards - Tips Tab
const DealerTipsCard: React.FC<{
  dealerName: string;
  downs: DealerDown[];
  totals: {
    totalTips: number;
    paidTips: number;
    unpaidTips: number;
    allPaid: boolean;
    somePaid: boolean;
  };
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (down: DealerDown) => void;
  onMarkPaid: (id: string) => void;
  onMarkUnpaid: (id: string) => void;
  formatCurrency: (amount: number) => string;
  formatTime: (dateString: string) => string;
}> = ({ dealerName, downs, totals, isExpanded, onToggle, onEdit, onMarkPaid, onMarkUnpaid, formatCurrency, formatTime }) => {
  return (
    <View className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      {/* Header - Always Visible */}
      <Pressable onPress={onToggle} className="p-4">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2 flex-1">
            <Text className="text-white text-xl font-bold">{dealerName}</Text>
            <View className="bg-slate-800 px-2 py-1 rounded-md">
              <Text className="text-slate-400 text-xs font-medium">{downs.length} down{downs.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            {totals.allPaid ? (
              <View className="flex-row items-center gap-1 bg-emerald-900/30 px-2 py-1 rounded-md border border-emerald-700/50">
                <CheckCircle size={14} color="#10b981" />
                <Text className="text-emerald-400 text-xs font-medium">All Paid</Text>
              </View>
            ) : totals.somePaid ? (
              <View className="flex-row items-center gap-1 bg-blue-900/30 px-2 py-1 rounded-md border border-blue-700/50">
                <Circle size={14} color="#3b82f6" />
                <Text className="text-blue-400 text-xs font-medium">Partial</Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-1 bg-amber-900/30 px-2 py-1 rounded-md border border-amber-700/50">
                <Circle size={14} color="#f59e0b" />
                <Text className="text-amber-400 text-xs font-medium">Unpaid</Text>
              </View>
            )}
            {isExpanded ? (
              <ChevronDown size={20} color="#94a3b8" />
            ) : (
              <ChevronRight size={20} color="#94a3b8" />
            )}
          </View>
        </View>

        {/* Summary Stats */}
        <View className="flex-row gap-2">
          <View className="flex-1 bg-slate-800 rounded-lg p-3">
            <Text className="text-slate-400 text-xs font-medium mb-1">Total Tips</Text>
            <Text className="text-amber-400 text-base font-bold">{formatCurrency(totals.totalTips)}</Text>
          </View>
          <View className="flex-1 bg-slate-800 rounded-lg p-3">
            <Text className="text-slate-400 text-xs font-medium mb-1">Paid</Text>
            <Text className="text-emerald-400 text-base font-bold">{formatCurrency(totals.paidTips)}</Text>
          </View>
          <View className="flex-1 bg-amber-900/20 rounded-lg p-3 border border-amber-800/30">
            <Text className="text-amber-300 text-xs font-medium mb-1">Unpaid</Text>
            <Text className="text-amber-300 text-base font-bold">{formatCurrency(totals.unpaidTips)}</Text>
          </View>
        </View>
      </Pressable>

      {/* Expandable Individual Downs */}
      {isExpanded && (
        <View className="border-t border-slate-800 bg-slate-950">
          {downs.map((down, index) => (
            <View key={down.id} className={index > 0 ? "border-t border-slate-800" : ""}>
              <View className="p-4">
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-slate-300 text-sm font-medium">Down #{downs.length - index}</Text>
                      {down.tipsPaid ? (
                        <View className="flex-row items-center gap-1 bg-emerald-900/30 px-2 py-0.5 rounded-md border border-emerald-700/50">
                          <CheckCircle size={12} color="#10b981" />
                          <Text className="text-emerald-400 text-xs font-medium">Paid</Text>
                        </View>
                      ) : (
                        <View className="flex-row items-center gap-1 bg-amber-900/30 px-2 py-0.5 rounded-md border border-amber-700/50">
                          <Circle size={12} color="#f59e0b" />
                          <Text className="text-amber-400 text-xs font-medium">Unpaid</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-slate-500 text-xs">{formatTime(down.timestamp)}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onEdit(down);
                    }}
                    className="p-2"
                  >
                    <Edit3 size={16} color="#3b82f6" />
                  </Pressable>
                </View>

                <View className="flex-row gap-2 mb-2">
                  <View className="flex-1 bg-slate-900 rounded-lg p-2 border border-slate-800">
                    <Text className="text-slate-500 text-xs mb-1">Tips</Text>
                    <Text className="text-amber-400 text-sm font-bold">{formatCurrency(down.tips)}</Text>
                  </View>
                </View>

                {!down.tipsPaid ? (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      onMarkPaid(down.id);
                    }}
                    className="bg-emerald-600 py-2.5 rounded-lg"
                  >
                    <Text className="text-white text-center font-bold text-sm">Pay Tips</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      onMarkUnpaid(down.id);
                    }}
                    className="bg-slate-700 py-2.5 rounded-lg"
                  >
                    <Text className="text-slate-300 text-center font-bold text-sm">Mark Unpaid</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// Component for grouped dealer cards - Rake Tab
const DealerRakeCard: React.FC<{
  dealerName: string;
  downs: DealerDown[];
  totals: {
    totalRake: number;
    claimedRake: number;
    unclaimedRake: number;
    allClaimed: boolean;
    someClaimed: boolean;
  };
  isExpanded: boolean;
  onToggle: () => void;
  onClaimRake: (id: string) => void;
  onUnclaimRake: (id: string) => void;
  formatCurrency: (amount: number) => string;
  formatTime: (dateString: string) => string;
}> = ({ dealerName, downs, totals, isExpanded, onToggle, onClaimRake, onUnclaimRake, formatCurrency, formatTime }) => {
  return (
    <View className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      {/* Header - Always Visible */}
      <Pressable onPress={onToggle} className="p-4">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2 flex-1">
            <Text className="text-white text-xl font-bold">{dealerName}</Text>
            <View className="bg-slate-800 px-2 py-1 rounded-md">
              <Text className="text-slate-400 text-xs font-medium">{downs.length} down{downs.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            {totals.allClaimed ? (
              <View className="flex-row items-center gap-1 bg-emerald-900/30 px-2 py-1 rounded-md border border-emerald-700/50">
                <CheckCircle size={14} color="#10b981" />
                <Text className="text-emerald-400 text-xs font-medium">Claimed</Text>
              </View>
            ) : totals.someClaimed ? (
              <View className="flex-row items-center gap-1 bg-blue-900/30 px-2 py-1 rounded-md border border-blue-700/50">
                <Circle size={14} color="#3b82f6" />
                <Text className="text-blue-400 text-xs font-medium">Partial</Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-1 bg-purple-900/30 px-2 py-1 rounded-md border border-purple-700/50">
                <Circle size={14} color="#a855f7" />
                <Text className="text-purple-400 text-xs font-medium">Unclaimed</Text>
              </View>
            )}
            {isExpanded ? (
              <ChevronDown size={20} color="#94a3b8" />
            ) : (
              <ChevronRight size={20} color="#94a3b8" />
            )}
          </View>
        </View>

        {/* Summary Stats */}
        <View className="flex-row gap-2">
          <View className="flex-1 bg-slate-800 rounded-lg p-3">
            <Text className="text-slate-400 text-xs font-medium mb-1">Total Rake</Text>
            <Text className="text-purple-400 text-base font-bold">{formatCurrency(totals.totalRake)}</Text>
          </View>
          <View className="flex-1 bg-slate-800 rounded-lg p-3">
            <Text className="text-slate-400 text-xs font-medium mb-1">Claimed</Text>
            <Text className="text-emerald-400 text-base font-bold">{formatCurrency(totals.claimedRake)}</Text>
          </View>
          <View className="flex-1 bg-purple-900/20 rounded-lg p-3 border border-purple-800/30">
            <Text className="text-purple-300 text-xs font-medium mb-1">Unclaimed</Text>
            <Text className="text-purple-300 text-base font-bold">{formatCurrency(totals.unclaimedRake)}</Text>
          </View>
        </View>
      </Pressable>

      {/* Expandable Individual Downs */}
      {isExpanded && (
        <View className="border-t border-slate-800 bg-slate-950">
          {downs.map((down, index) => (
            <View key={down.id} className={index > 0 ? "border-t border-slate-800" : ""}>
              <View className="p-4">
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-slate-300 text-sm font-medium">Down #{downs.length - index}</Text>
                      {down.rakeClaimed ? (
                        <View className="flex-row items-center gap-1 bg-emerald-900/30 px-2 py-0.5 rounded-md border border-emerald-700/50">
                          <CheckCircle size={12} color="#10b981" />
                          <Text className="text-emerald-400 text-xs font-medium">Claimed</Text>
                        </View>
                      ) : (
                        <View className="flex-row items-center gap-1 bg-purple-900/30 px-2 py-0.5 rounded-md border border-purple-700/50">
                          <Circle size={12} color="#a855f7" />
                          <Text className="text-purple-400 text-xs font-medium">Unclaimed</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-slate-500 text-xs">{formatTime(down.timestamp)}</Text>
                  </View>
                </View>

                <View className="flex-row gap-2 mb-2">
                  <View className="flex-1 bg-slate-900 rounded-lg p-2 border border-slate-800">
                    <Text className="text-slate-500 text-xs mb-1">Rake</Text>
                    <Text className="text-purple-400 text-sm font-bold">{formatCurrency(down.rake)}</Text>
                  </View>
                </View>

                {!down.rakeClaimed ? (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      onClaimRake(down.id);
                    }}
                    className="bg-purple-600 py-2.5 rounded-lg"
                  >
                    <Text className="text-white text-center font-bold text-sm">Claim Rake</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      onUnclaimRake(down.id);
                    }}
                    className="bg-slate-700 py-2.5 rounded-lg"
                  >
                    <Text className="text-slate-300 text-center font-bold text-sm">Mark Unclaimed</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const DealersScreen = ({ navigation }: Props) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("tips");
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingDown, setEditingDown] = useState<DealerDown | null>(null);
  const [dealerName, setDealerName] = useState("");
  const [tips, setTips] = useState("");
  const [rake, setRake] = useState("");
  const [expandedDealers, setExpandedDealers] = useState<Set<string>>(new Set());

  // Fetch active game session - with retry and refetch options to prevent stale data
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

  // Fetch dealer downs
  const { data: downsData } = useQuery({
    queryKey: ["dealerDowns", sessionId],
    queryFn: () => api.get<GetDealerDownsResponse>(`/api/dealers/downs/${sessionId}`),
    enabled: !!sessionId,
  });

  // Add dealer down mutation with automatic retry
  const addDownMutation = useMutation({
    mutationFn: (data: AddDealerDownRequest) => {
      console.log("[DealersScreen] Mutation function called with data:", data);
      return api.post("/api/dealers/down", data);
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    onSuccess: () => {
      console.log("[DealersScreen] Mutation successful");
      queryClient.invalidateQueries({ queryKey: ["dealerDowns"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      setModalVisible(false);
      resetForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      const isNetworkError = error instanceof ApiError && error.type === "NETWORK_ERROR";
      const errorMessage = isNetworkError
        ? "Connection issue - your data was saved locally. The app will sync when connection is restored. You can also try again."
        : error instanceof ApiError
        ? error.getUserMessage()
        : "Failed to add dealer down. Please try again.";
      console.log("[DealersScreen] Mutation failed:", error?.message || String(error));
      console.log("[DealersScreen] Error details:", error instanceof ApiError ? error.details : error?.message || "Unknown");
      Alert.alert(
        isNetworkError ? "Connection Issue" : "Error",
        errorMessage,
        [
          { text: "OK", style: "cancel" },
          ...(isNetworkError ? [{ text: "Retry", onPress: () => addDownMutation.reset() }] : []),
        ]
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  // Update dealer down mutation
  const updateDownMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDealerDownRequest }) =>
      api.put(`/api/dealers/down/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealerDowns"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      setEditModalVisible(false);
      setEditingDown(null);
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
      setEditModalVisible(false);
      setEditingDown(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Mark tips as paid mutation
  const markTipsPaidMutation = useMutation({
    mutationFn: (id: string) => api.put<MarkDealerTipsPaidResponse>(`/api/dealers/down/${id}/pay`, {}),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealerDowns"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      const isNetworkError = error instanceof ApiError && error.type === "NETWORK_ERROR";
      const errorMessage = isNetworkError
        ? "Connection interrupted. Please try again."
        : error instanceof ApiError
        ? error.getUserMessage()
        : "Failed to mark tips as paid. Please try again.";
      console.log("[DealersScreen] Failed to mark tips as paid:", error?.message || String(error));
      Alert.alert(isNetworkError ? "Connection Issue" : "Error", errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  // Mark tips as unpaid mutation
  const markTipsUnpaidMutation = useMutation({
    mutationFn: (id: string) => api.put<MarkDealerTipsPaidResponse>(`/api/dealers/down/${id}/unpay`, {}),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealerDowns"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      const isNetworkError = error instanceof ApiError && error.type === "NETWORK_ERROR";
      const errorMessage = isNetworkError
        ? "Connection interrupted. Please try again."
        : error instanceof ApiError
        ? error.getUserMessage()
        : "Failed to mark tips as unpaid. Please try again.";
      console.log("[DealersScreen] Failed to mark tips as unpaid:", error?.message || String(error));
      Alert.alert(isNetworkError ? "Connection Issue" : "Error", errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  // Claim rake mutation
  const claimRakeMutation = useMutation({
    mutationFn: (id: string) => api.put<MarkDealerTipsPaidResponse>(`/api/dealers/down/${id}/claim-rake`, {}),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealerDowns"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      const isNetworkError = error instanceof ApiError && error.type === "NETWORK_ERROR";
      const errorMessage = isNetworkError
        ? "Connection interrupted. Please try again."
        : error instanceof ApiError
        ? error.getUserMessage()
        : "Failed to claim rake. Please try again.";
      console.log("[DealersScreen] Failed to claim rake:", error?.message || String(error));
      Alert.alert(isNetworkError ? "Connection Issue" : "Error", errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  // Unclaim rake mutation
  const unclaimRakeMutation = useMutation({
    mutationFn: (id: string) => api.put<MarkDealerTipsPaidResponse>(`/api/dealers/down/${id}/unclaim-rake`, {}),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dealerDowns"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      const isNetworkError = error instanceof ApiError && error.type === "NETWORK_ERROR";
      const errorMessage = isNetworkError
        ? "Connection interrupted. Please try again."
        : error instanceof ApiError
        ? error.getUserMessage()
        : "Failed to unclaim rake. Please try again.";
      console.log("[DealersScreen] Failed to unclaim rake:", error?.message || String(error));
      Alert.alert(isNetworkError ? "Connection Issue" : "Error", errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const resetForm = () => {
    setDealerName("");
    setTips("");
    setRake("");
  };

  const handleEdit = (down: DealerDown) => {
    setEditingDown(down);
    setDealerName(down.dealerName);
    setTips(down.tips.toString());
    setRake(down.rake.toString());
    setEditModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmit = async () => {
    console.log("[DealersScreen] handleSubmit called", { dealerName, tips, rake, sessionId });

    if (!dealerName.trim()) {
      console.log("[DealersScreen] No dealer name, showing alert");
      Alert.alert("Missing Information", "Please enter a dealer name");
      return;
    }

    // If no sessionId, try to refetch the game session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      console.log("[DealersScreen] No sessionId, attempting to refetch game session");
      try {
        const result = await refetchGame();
        currentSessionId = result.data?.session?.id;
        console.log("[DealersScreen] Refetched sessionId:", currentSessionId);
      } catch (e) {
        console.error("[DealersScreen] Failed to refetch game session:", e);
      }
    }

    if (!currentSessionId) {
      console.error("[DealersScreen] No sessionId after refetch, showing error");
      Alert.alert("Error", "No active game session found. Please try refreshing the app.");
      return;
    }

    const numTips = parseFloat(tips) || 0;
    const numRake = parseFloat(rake) || 0;

    if (numTips < 0 || numRake < 0) {
      console.log("[DealersScreen] Invalid tips/rake values");
      Alert.alert("Invalid Amount", "Tips and rake must be positive numbers");
      return;
    }

    const requestData = {
      dealerName: dealerName.trim(),
      tips: numTips,
      rake: numRake,
      gameSessionId: currentSessionId,
    };

    console.log("[DealersScreen] Submitting dealer down:", requestData);

    addDownMutation.mutate(requestData);
  };

  const handleUpdate = () => {
    if (!dealerName.trim() || !editingDown) return;

    const numTips = parseFloat(tips) || 0;
    const numRake = parseFloat(rake) || 0;

    if (numTips < 0 || numRake < 0) return;

    updateDownMutation.mutate({
      id: editingDown.id,
      data: {
        dealerName: dealerName.trim(),
        tips: numTips,
        rake: numRake,
      },
    });
  };

  const handleDelete = () => {
    if (!editingDown) return;
    deleteDownMutation.mutate(editingDown.id);
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const toggleDealer = (name: string) => {
    setExpandedDealers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
      }
      return newSet;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Group downs by dealer name
  const groupedDowns = React.useMemo(() => {
    if (!downsData?.downs) return new Map<string, DealerDown[]>();

    const grouped = new Map<string, DealerDown[]>();
    downsData.downs.forEach((down) => {
      const existing = grouped.get(down.dealerName) || [];
      grouped.set(down.dealerName, [...existing, down]);
    });

    // Sort each dealer's downs by timestamp (most recent first)
    grouped.forEach((downs) => {
      downs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });

    return grouped;
  }, [downsData?.downs]);

  // Calculate totals for tips tab
  const getTipsTotals = (downs: DealerDown[]) => {
    const totalTips = downs.reduce((sum, d) => sum + d.tips, 0);
    const paidTips = downs.filter((d) => d.tipsPaid).reduce((sum, d) => sum + d.tips, 0);
    const unpaidTips = downs.filter((d) => !d.tipsPaid).reduce((sum, d) => sum + d.tips, 0);
    const allPaid = downs.every((d) => d.tipsPaid);
    const somePaid = downs.some((d) => d.tipsPaid);

    return { totalTips, paidTips, unpaidTips, allPaid, somePaid };
  };

  // Calculate totals for rake tab
  const getRakeTotals = (downs: DealerDown[]) => {
    const totalRake = downs.reduce((sum, d) => sum + d.rake, 0);
    const claimedRake = downs.filter((d) => d.rakeClaimed).reduce((sum, d) => sum + d.rake, 0);
    const unclaimedRake = downs.filter((d) => !d.rakeClaimed).reduce((sum, d) => sum + d.rake, 0);
    const allClaimed = downs.every((d) => d.rakeClaimed);
    const someClaimed = downs.some((d) => d.rakeClaimed);

    return { totalRake, claimedRake, unclaimedRake, allClaimed, someClaimed };
  };

  return (
    <View className="flex-1 bg-slate-950">
      {/* Tab Switcher */}
      <View className="flex-row p-4 gap-2">
        <Pressable
          onPress={() => {
            setActiveTab("tips");
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl ${
            activeTab === "tips" ? "bg-amber-600" : "bg-slate-800"
          }`}
        >
          <DollarSign size={18} color={activeTab === "tips" ? "#fff" : "#94a3b8"} />
          <Text className={`font-bold ${activeTab === "tips" ? "text-white" : "text-slate-400"}`}>
            Pay Dealers
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setActiveTab("rake");
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl ${
            activeTab === "rake" ? "bg-purple-600" : "bg-slate-800"
          }`}
        >
          <Wallet size={18} color={activeTab === "rake" ? "#fff" : "#94a3b8"} />
          <Text className={`font-bold ${activeTab === "rake" ? "text-white" : "text-slate-400"}`}>
            Claim Rake
          </Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="px-4 pb-4 gap-4">
          {activeTab === "tips" ? (
            <>
              {Array.from(groupedDowns.entries()).map(([name, downs]) => {
                const totals = getTipsTotals(downs);
                const isExpanded = expandedDealers.has(name);

                return (
                  <DealerTipsCard
                    key={name}
                    dealerName={name}
                    downs={downs}
                    totals={totals}
                    isExpanded={isExpanded}
                    onToggle={() => toggleDealer(name)}
                    onEdit={handleEdit}
                    onMarkPaid={(id: string) => markTipsPaidMutation.mutate(id)}
                    onMarkUnpaid={(id: string) => markTipsUnpaidMutation.mutate(id)}
                    formatCurrency={formatCurrency}
                    formatTime={formatTime}
                  />
                );
              })}
              {groupedDowns.size === 0 && (
                <View className="items-center justify-center py-12">
                  <Text className="text-slate-500 text-center">No dealer downs yet</Text>
                  <Text className="text-slate-600 text-center text-sm mt-1">
                    Log tips and rake for each dealer down
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              {Array.from(groupedDowns.entries()).map(([name, downs]) => {
                const totals = getRakeTotals(downs);
                const isExpanded = expandedDealers.has(name);

                return (
                  <DealerRakeCard
                    key={name}
                    dealerName={name}
                    downs={downs}
                    totals={totals}
                    isExpanded={isExpanded}
                    onToggle={() => toggleDealer(name)}
                    onClaimRake={(id: string) => claimRakeMutation.mutate(id)}
                    onUnclaimRake={(id: string) => unclaimRakeMutation.mutate(id)}
                    formatCurrency={formatCurrency}
                    formatTime={formatTime}
                  />
                );
              })}
              {groupedDowns.size === 0 && (
                <View className="items-center justify-center py-12">
                  <Text className="text-slate-500 text-center">No dealer downs yet</Text>
                  <Text className="text-slate-600 text-center text-sm mt-1">
                    Log tips and rake for each dealer down
                  </Text>
                </View>
              )}
            </>
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
          <Pressable
            className="flex-1 bg-black/50"
            onPress={() => {
              setModalVisible(false);
              resetForm();
            }}
          />
          <View className="bg-slate-900 rounded-t-3xl p-6 border-t border-slate-700">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-white text-2xl font-bold">Dealer Down</Text>
              <Pressable
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
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
                  editable
                  autoCapitalize="words"
                  autoCorrect={false}
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
                  editable
                  returnKeyType="next"
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
                  editable
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
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

      {/* Edit Dealer Down Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end"
        >
          <Pressable
            className="flex-1 bg-black/50"
            onPress={() => {
              setEditModalVisible(false);
              setEditingDown(null);
              resetForm();
            }}
          />
          <View className="bg-slate-900 rounded-t-3xl p-6 border-t border-slate-700">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-white text-2xl font-bold">Edit Dealer Down</Text>
              <Pressable
                onPress={() => {
                  setEditModalVisible(false);
                  setEditingDown(null);
                  resetForm();
                }}
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
                  editable
                  autoCapitalize="words"
                  autoCorrect={false}
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
                  editable
                  returnKeyType="next"
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
                  editable
                  returnKeyType="done"
                  onSubmitEditing={handleUpdate}
                />
              </View>

              <Pressable
                onPress={handleUpdate}
                disabled={!dealerName.trim() || updateDownMutation.isPending}
                className={`bg-blue-600 py-4 rounded-lg mt-2 ${
                  (!dealerName.trim() || updateDownMutation.isPending) && "opacity-50"
                }`}
              >
                <Text className="text-white text-center font-bold text-lg">
                  {updateDownMutation.isPending ? "Updating..." : "Update Down"}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleDelete}
                disabled={deleteDownMutation.isPending}
                className={`bg-red-600 py-4 rounded-lg ${
                  deleteDownMutation.isPending && "opacity-50"
                }`}
              >
                <Text className="text-white text-center font-bold text-lg">
                  {deleteDownMutation.isPending ? "Deleting..." : "Delete Down"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default DealersScreen;
