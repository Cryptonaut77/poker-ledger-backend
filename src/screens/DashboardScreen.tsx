import React from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { TrendingUp, TrendingDown, DollarSign, Users, Dices, Receipt } from "lucide-react-native";

import { api } from "@/lib/api";
import type { BottomTabScreenProps } from "@/navigation/types";
import type { GetActiveGameResponse, GameSummary } from "@/shared/contracts";

type Props = BottomTabScreenProps<"DashboardTab">;

const DashboardScreen = ({ navigation }: Props) => {

  // Fetch active game session
  const { data: gameData, isLoading: isLoadingGame } = useQuery({
    queryKey: ["activeGame"],
    queryFn: () => api.get<GetActiveGameResponse>("/api/game/active"),
  });

  const sessionId = gameData?.session.id;

  // Fetch game summary
  const {
    data: summary,
    isLoading: isLoadingSummary,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["gameSummary", sessionId],
    queryFn: () => api.get<GameSummary>(`/api/game/${sessionId}/summary`),
    enabled: !!sessionId,
  });

  const isLoading = isLoadingGame || isLoadingSummary;
  const isRefreshing = isRefetching;

  // Format currency
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
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
          <Text className="text-white text-3xl font-bold mb-2">Poker Game</Text>
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
              <Text className="text-slate-400 text-sm font-medium">House Profit</Text>
              {summary && summary.netProfit >= 0 ? (
                <TrendingUp size={20} color="#10b981" />
              ) : (
                <TrendingDown size={20} color="#ef4444" />
              )}
            </View>
            <Text
              className={`text-5xl font-bold ${
                summary && summary.netProfit >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {summary ? formatCurrency(summary.netProfit) : "$0.00"}
            </Text>
            <Text className="text-slate-500 text-xs mt-2">Rake - Expenses</Text>
          </LinearGradient>
        </View>

        {/* Stats Grid */}
        <View className="px-4 gap-4">
          {/* Row 1 */}
          <View className="flex-row gap-4">
            <StatCard
              icon={<DollarSign size={24} color="#10b981" />}
              label="Buy-ins"
              value={summary ? formatCurrency(summary.totalBuyIns) : "$0.00"}
              bgColor="bg-slate-900"
            />
            <StatCard
              icon={<DollarSign size={24} color="#ef4444" />}
              label="Cashouts"
              value={summary ? formatCurrency(summary.totalCashouts) : "$0.00"}
              bgColor="bg-slate-900"
            />
          </View>

          {/* Row 2 */}
          <View className="flex-row gap-4">
            <StatCard
              icon={<Dices size={24} color="#f59e0b" />}
              label="Tips"
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
            <StatCard
              icon={<Users size={24} color="#3b82f6" />}
              label="Players"
              value={summary ? summary.playerCount.toString() : "0"}
              bgColor="bg-slate-900"
            />
          </View>
        </View>
      </ScrollView>
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
