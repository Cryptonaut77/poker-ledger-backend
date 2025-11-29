import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, Trash2, ChevronRight, Calendar, Users, DollarSign } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { api } from "../lib/api";
import type { GameSessionWithData, GetGameHistoryResponse, DeleteGameResponse } from "@/shared/contracts";
import { format } from "date-fns";

export default function GameHistoryScreen() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch game history
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["gameHistory"],
    queryFn: async () => {
      return api.get<GetGameHistoryResponse>("/api/game/history");
    },
  });

  // Delete game mutation
  const deleteGameMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return api.delete<DeleteGameResponse>(`/api/game/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gameHistory"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleDeleteGame = (sessionId: string, gameName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Delete Game",
      `Are you sure you want to permanently delete "${gameName}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteGameMutation.mutate(sessionId),
        },
      ]
    );
  };

  const toggleExpanded = (sessionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedId(expandedId === sessionId ? null : sessionId);
  };

  const calculateGameStats = (session: GameSessionWithData) => {
    const totalBuyIns = session.playerTransactions
      .filter((t) => t.type === "buy-in")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalCashouts = session.playerTransactions
      .filter((t) => t.type === "cashout")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalTips = session.dealerDowns.reduce((sum, d) => sum + d.tips, 0);
    const totalRake = session.dealerDowns.reduce((sum, d) => sum + d.rake, 0);
    const totalExpenses = session.expenses.reduce((sum, e) => sum + e.amount, 0);

    const totalPaidRake = session.dealerDowns
      .filter((d) => d.tipsPaid)
      .reduce((sum, d) => sum + d.rake, 0);

    const netProfit = totalPaidRake - totalExpenses;

    const uniquePlayers = new Set(session.playerTransactions.map((t) => t.playerName));
    const playerCount = uniquePlayers.size;

    return {
      totalBuyIns,
      totalCashouts,
      totalTips,
      totalRake,
      totalExpenses,
      netProfit,
      playerCount,
    };
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center">
        <Text className="text-slate-400 text-base">Loading history...</Text>
      </View>
    );
  }

  if (!data?.sessions || data.sessions.length === 0) {
    return (
      <ScrollView
        className="flex-1 bg-slate-950"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#94a3b8" />
        }
      >
        <View className="flex-1 items-center justify-center p-8 mt-32">
          <Archive size={64} color="#475569" />
          <Text className="text-slate-400 text-lg mt-4 text-center">No game history yet</Text>
          <Text className="text-slate-500 text-sm mt-2 text-center">
            Saved games will appear here
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-950"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#94a3b8" />
      }
    >
      <View className="p-4 pb-8">
        {data.sessions.map((session) => {
          const stats = calculateGameStats(session);
          const isExpanded = expandedId === session.id;
          const startDate = new Date(session.startedAt);
          const endDate = session.endedAt ? new Date(session.endedAt) : null;

          return (
            <View key={session.id} className="mb-3">
              <TouchableOpacity
                onPress={() => toggleExpanded(session.id)}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-4"
                activeOpacity={0.7}
              >
                {/* Header */}
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-slate-800 rounded-full p-2 mr-3">
                      <Archive size={20} color="#94a3b8" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-semibold text-base">
                        {session.name}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <Calendar size={12} color="#64748b" />
                        <Text className="text-slate-500 text-xs ml-1">
                          {format(startDate, "MMM d, yyyy")}
                          {endDate && ` • ${format(endDate, "h:mm a")}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <ChevronRight
                    size={20}
                    color="#64748b"
                    style={{
                      transform: [{ rotate: isExpanded ? "90deg" : "0deg" }],
                    }}
                  />
                </View>

                {/* Quick Stats */}
                <View className="flex-row justify-between pt-3 border-t border-slate-800">
                  <View className="items-center flex-1">
                    <View className="flex-row items-center">
                      <DollarSign size={14} color="#10b981" />
                      <Text
                        className={`text-sm font-semibold ml-1 ${
                          stats.netProfit >= 0 ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        ${stats.netProfit.toFixed(2)}
                      </Text>
                    </View>
                    <Text className="text-slate-500 text-xs mt-1">Profit</Text>
                  </View>
                  <View className="items-center flex-1">
                    <View className="flex-row items-center">
                      <Users size={14} color="#94a3b8" />
                      <Text className="text-white text-sm font-semibold ml-1">
                        {stats.playerCount}
                      </Text>
                    </View>
                    <Text className="text-slate-500 text-xs mt-1">Players</Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-white text-sm font-semibold">
                      ${stats.totalBuyIns.toFixed(0)}
                    </Text>
                    <Text className="text-slate-500 text-xs mt-1">Buy-ins</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Expanded Details */}
              {isExpanded && (
                <View className="bg-slate-900/40 border border-slate-800 border-t-0 rounded-b-xl px-4 pb-4 -mt-3 pt-4">
                  {/* Detailed Stats */}
                  <View className="space-y-2 mb-4">
                    <View className="flex-row justify-between">
                      <Text className="text-slate-400 text-sm">Total Cashouts</Text>
                      <Text className="text-white text-sm font-medium">
                        ${stats.totalCashouts.toFixed(2)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-slate-400 text-sm">Total Tips</Text>
                      <Text className="text-white text-sm font-medium">
                        ${stats.totalTips.toFixed(2)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-slate-400 text-sm">Total Rake</Text>
                      <Text className="text-white text-sm font-medium">
                        ${stats.totalRake.toFixed(2)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-slate-400 text-sm">Total Expenses</Text>
                      <Text className="text-white text-sm font-medium">
                        ${stats.totalExpenses.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Transaction Counts */}
                  <View className="bg-slate-800/50 rounded-lg p-3 mb-4">
                    <View className="flex-row justify-around">
                      <View className="items-center">
                        <Text className="text-blue-400 text-lg font-bold">
                          {session.playerTransactions.length}
                        </Text>
                        <Text className="text-slate-500 text-xs mt-1">Transactions</Text>
                      </View>
                      <View className="items-center">
                        <Text className="text-purple-400 text-lg font-bold">
                          {session.dealerDowns.length}
                        </Text>
                        <Text className="text-slate-500 text-xs mt-1">Dealer Downs</Text>
                      </View>
                      <View className="items-center">
                        <Text className="text-amber-400 text-lg font-bold">
                          {session.expenses.length}
                        </Text>
                        <Text className="text-slate-500 text-xs mt-1">Expenses</Text>
                      </View>
                    </View>
                  </View>

                  {/* Delete Button */}
                  <TouchableOpacity
                    onPress={() => handleDeleteGame(session.id, session.name)}
                    className="bg-red-500/10 border border-red-500/30 rounded-lg py-3 flex-row items-center justify-center"
                    activeOpacity={0.7}
                  >
                    <Trash2 size={16} color="#ef4444" />
                    <Text className="text-red-500 font-semibold text-sm ml-2">Delete Game</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
