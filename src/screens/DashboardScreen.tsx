import React from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, Modal, Alert, TextInput } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { TrendingUp, TrendingDown, DollarSign, Users, Dices, Receipt, CheckCircle, AlertCircle, Power, Trash2, PlusCircle, Table, Edit2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { api } from "@/lib/api";
import { useTableStore } from "@/lib/tableStore";
import type { BottomTabScreenProps } from "@/navigation/types";
import type { GetActiveGameResponse, GetActiveTablesResponse, GameSummary, GetPlayerTransactionsResponse } from "@/shared/contracts";

type Props = BottomTabScreenProps<"DashboardTab">;

const DashboardScreen = ({ navigation }: Props) => {
  const queryClient = useQueryClient();
  const [manageModalVisible, setManageModalVisible] = React.useState(false);
  const [addTableModalVisible, setAddTableModalVisible] = React.useState(false);
  const [tableManageModalVisible, setTableManageModalVisible] = React.useState(false);
  const [editTableNameModalVisible, setEditTableNameModalVisible] = React.useState(false);
  const [newTableName, setNewTableName] = React.useState("");
  const [editingTableName, setEditingTableName] = React.useState("");
  const [managingTable, setManagingTable] = React.useState<{ id: string; tableName: string } | null>(null);

  const selectedTableId = useTableStore((s) => s.selectedTableId);
  const setSelectedTableId = useTableStore((s) => s.setSelectedTableId);

  // Fetch all active tables
  const { data: tablesData } = useQuery({
    queryKey: ["activeTables"],
    queryFn: () => api.get<GetActiveTablesResponse>("/api/game/tables"),
  });

  // Fetch active game session (for backward compatibility)
  const { data: gameData, isLoading: isLoadingGame } = useQuery({
    queryKey: ["activeGame"],
    queryFn: () => api.get<GetActiveGameResponse>("/api/game/active"),
  });

  // Use selected table or fall back to first active table
  const sessionId = selectedTableId || gameData?.session.id;
  const currentTable = React.useMemo(() => {
    if (!tablesData?.tables) return gameData?.session;
    return tablesData.tables.find((t) => t.id === sessionId) || tablesData.tables[0] || gameData?.session;
  }, [tablesData, sessionId, gameData]);

  // Set initial selected table
  React.useEffect(() => {
    if (!selectedTableId && currentTable) {
      setSelectedTableId(currentTable.id);
    }
  }, [selectedTableId, currentTable, setSelectedTableId]);

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

  // Fetch player transactions to calculate payment method breakdown
  const { data: transactionsData } = useQuery({
    queryKey: ["playerTransactions", sessionId],
    queryFn: () => api.get<GetPlayerTransactionsResponse>(`/api/players/transactions/${sessionId}`),
    enabled: !!sessionId,
  });

  // Calculate buy-ins by payment method
  const paymentBreakdown = React.useMemo(() => {
    if (!transactionsData?.transactions) {
      return { cash: 0, electronic: 0, credit: 0 };
    }

    const buyIns = transactionsData.transactions.filter((t) => t.type === "buy-in");

    return {
      cash: buyIns.filter((t) => t.paymentMethod === "cash").reduce((sum, t) => sum + t.amount, 0),
      electronic: buyIns.filter((t) => t.paymentMethod === "electronic").reduce((sum, t) => sum + t.amount, 0),
      credit: buyIns.filter((t) => t.paymentMethod === "credit").reduce((sum, t) => sum + t.amount, 0),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeGame"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      queryClient.invalidateQueries({ queryKey: ["playerTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["dealerDowns"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setManageModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Start new game mutation
  const startNewGameMutation = useMutation({
    mutationFn: () => api.post<{ session: { id: string } }>("/api/game/new", {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["activeGame"] });
      queryClient.invalidateQueries({ queryKey: ["activeTables"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      queryClient.invalidateQueries({ queryKey: ["playerTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["dealerDowns"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      // Switch to the new table
      if (data?.session) {
        setSelectedTableId(data.session.id);
      }
      setManageModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Add table mutation
  const addTableMutation = useMutation({
    mutationFn: (tableName: string) => api.post<{ session: { id: string } }>("/api/game/table", { tableName }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["activeTables"] });
      queryClient.invalidateQueries({ queryKey: ["activeGame"] });
      // Switch to the new table
      if (data?.session) {
        setSelectedTableId(data.session.id);
      }
      setAddTableModalVisible(false);
      setNewTableName("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Update table name mutation
  const updateTableNameMutation = useMutation({
    mutationFn: ({ id, tableName }: { id: string; tableName: string }) =>
      api.put(`/api/game/${id}/name`, { tableName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeTables"] });
      queryClient.invalidateQueries({ queryKey: ["activeGame"] });
      setEditTableNameModalVisible(false);
      setManagingTable(null);
      setEditingTableName("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // End specific table mutation
  const endTableMutation = useMutation({
    mutationFn: (tableId: string) => api.post("/api/game/end", { sessionId: tableId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeGame"] });
      queryClient.invalidateQueries({ queryKey: ["activeTables"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      setTableManageModalVisible(false);
      setManagingTable(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Delete specific table mutation
  const deleteTableMutation = useMutation({
    mutationFn: (tableId: string) => api.delete(`/api/game/${tableId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeGame"] });
      queryClient.invalidateQueries({ queryKey: ["activeTables"] });
      queryClient.invalidateQueries({ queryKey: ["gameSummary"] });
      queryClient.invalidateQueries({ queryKey: ["playerTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["dealerDowns"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setTableManageModalVisible(false);
      setManagingTable(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
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
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-white text-3xl font-bold">Poker Game</Text>
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

          {/* Active Tables Info */}
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Table size={16} color="#10b981" />
              <Text className="text-emerald-300 text-sm font-medium">
                {tablesData?.tables.length || 1} Active Table{(tablesData?.tables.length || 1) !== 1 ? 's' : ''}
              </Text>
            </View>
            {currentTable && (
              <Text className="text-slate-400 text-sm">
                Table: {currentTable.tableName}
              </Text>
            )}
          </View>

          {/* Table Selector */}
          {tablesData && tablesData.tables.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              <View className="flex-row gap-2">
                {tablesData.tables.map((table) => (
                  <Pressable
                    key={table.id}
                    onPress={() => {
                      setSelectedTableId(table.id);
                      Haptics.selectionAsync();
                    }}
                    onLongPress={() => {
                      setManagingTable({ id: table.id, tableName: table.tableName });
                      setTableManageModalVisible(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }}
                    className={`px-4 py-2 rounded-lg ${
                      table.id === sessionId ? 'bg-emerald-600' : 'bg-slate-800'
                    }`}
                  >
                    <Text className={`font-semibold ${
                      table.id === sessionId ? 'text-white' : 'text-slate-400'
                    }`}>
                      {table.tableName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}

          {currentTable && (
            <View className="flex-row items-center gap-2">
              <View className="w-2 h-2 rounded-full bg-emerald-500" />
              <Text className="text-emerald-300 text-sm">
                Started {formatDate(currentTable.startedAt)}
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
          {/* Payment Method Breakdown */}
          <View className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <Text className="text-white text-lg font-bold mb-4">Buy-in Payment Breakdown</Text>
            <View className="gap-3">
              <View className="flex-row items-center justify-between bg-slate-800 p-3 rounded-lg">
                <View className="flex-row items-center gap-2">
                  <View className="w-3 h-3 rounded-full bg-emerald-500" />
                  <Text className="text-slate-300 font-medium">Cash (In Till)</Text>
                </View>
                <Text className="text-emerald-400 text-xl font-bold">
                  {formatCurrency(paymentBreakdown.cash)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between bg-slate-800 p-3 rounded-lg">
                <View className="flex-row items-center gap-2">
                  <View className="w-3 h-3 rounded-full bg-blue-500" />
                  <Text className="text-slate-300 font-medium">Electronic</Text>
                </View>
                <Text className="text-blue-400 text-xl font-bold">
                  {formatCurrency(paymentBreakdown.electronic)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between bg-slate-800 p-3 rounded-lg">
                <View className="flex-row items-center gap-2">
                  <View className="w-3 h-3 rounded-full bg-amber-500" />
                  <Text className="text-slate-300 font-medium">Credit (Owed)</Text>
                </View>
                <Text className="text-amber-400 text-xl font-bold">
                  {formatCurrency(paymentBreakdown.credit)}
                </Text>
              </View>
            </View>
            <View className="mt-4 pt-4 border-t border-slate-700">
              <View className="flex-row items-center justify-between">
                <Text className="text-slate-400 font-medium">Total Buy-ins</Text>
                <Text className="text-white text-2xl font-bold">
                  {summary ? formatCurrency(summary.totalBuyIns) : "$0.00"}
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
              icon={<Table size={24} color="#10b981" />}
              label="Active Tables"
              value={tablesData?.tables.length?.toString() || "1"}
              bgColor="bg-slate-900"
            />
            <StatCard
              icon={<Receipt size={24} color="#8b5cf6" />}
              label="Expenses"
              value={summary ? formatCurrency(summary.totalExpenses) : "$0.00"}
              bgColor="bg-slate-900"
            />
          </View>

          {/* Row 3 */}
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
              {/* Add Table */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setManageModalVisible(false);
                  setAddTableModalVisible(true);
                }}
                className="bg-violet-600 py-4 rounded-lg flex-row items-center justify-center gap-2"
              >
                <Table size={20} color="#fff" />
                <Text className="text-white text-center font-bold text-lg">Add New Table</Text>
              </Pressable>

              {/* End & Save Game */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  endGameMutation.mutate();
                }}
                disabled={endGameMutation.isPending || !currentTable?.isActive}
                className={`bg-blue-600 py-4 rounded-lg flex-row items-center justify-center gap-2 ${
                  (endGameMutation.isPending || !currentTable?.isActive) && "opacity-50"
                }`}
              >
                <Power size={20} color="#fff" />
                <Text className="text-white text-center font-bold text-lg">
                  {endGameMutation.isPending ? "Ending Game..." : "End & Save Current Table"}
                </Text>
              </Pressable>

              {/* Start New Game */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  startNewGameMutation.mutate();
                }}
                disabled={startNewGameMutation.isPending}
                className={`bg-emerald-600 py-4 rounded-lg flex-row items-center justify-center gap-2 ${
                  startNewGameMutation.isPending && "opacity-50"
                }`}
              >
                <PlusCircle size={20} color="#fff" />
                <Text className="text-white text-center font-bold text-lg">
                  {startNewGameMutation.isPending ? "Starting..." : "Start New Table (Quick)"}
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
                <Text className="font-bold">Add Table:</Text> Create a new table with a custom name{"\n"}
                <Text className="font-bold">End & Save:</Text> Marks current table as complete{"\n"}
                <Text className="font-bold">Start New:</Text> Quickly creates a new table{"\n"}
                <Text className="font-bold">Delete:</Text> Permanently removes current table data
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Table Modal */}
      <Modal visible={addTableModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end">
          <Pressable
            className="flex-1 bg-black/50"
            onPress={() => {
              setAddTableModalVisible(false);
              setNewTableName("");
            }}
          />
          <View className="bg-slate-900 rounded-t-3xl p-6 border-t border-slate-700">
            <Text className="text-white text-2xl font-bold mb-6">Add New Table</Text>

            <View className="gap-4">
              <View>
                <Text className="text-slate-400 text-sm mb-2 font-medium">Table Name</Text>
                <TextInput
                  value={newTableName}
                  onChangeText={setNewTableName}
                  placeholder="e.g., Table 1, High Stakes, Tournament"
                  placeholderTextColor="#475569"
                  className="bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700"
                  autoFocus
                />
              </View>

              <Pressable
                onPress={() => {
                  if (newTableName.trim()) {
                    addTableMutation.mutate(newTableName.trim());
                  }
                }}
                disabled={!newTableName.trim() || addTableMutation.isPending}
                className={`bg-violet-600 py-4 rounded-lg flex-row items-center justify-center gap-2 ${
                  (!newTableName.trim() || addTableMutation.isPending) && "opacity-50"
                }`}
              >
                <Table size={20} color="#fff" />
                <Text className="text-white text-center font-bold text-lg">
                  {addTableMutation.isPending ? "Creating..." : "Create Table"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setAddTableModalVisible(false);
                  setNewTableName("");
                }}
                className="py-4 rounded-lg"
              >
                <Text className="text-slate-400 text-center font-medium text-lg">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Table Management Modal */}
      <Modal visible={tableManageModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end">
          <Pressable
            className="flex-1 bg-black/50"
            onPress={() => {
              setTableManageModalVisible(false);
              setManagingTable(null);
            }}
          />
          <View className="bg-slate-900 rounded-t-3xl p-6 border-t border-slate-700">
            <Text className="text-white text-2xl font-bold mb-6">
              Manage: {managingTable?.tableName}
            </Text>

            <View className="gap-3">
              {/* Edit Table Name */}
              <Pressable
                onPress={() => {
                  setEditingTableName(managingTable?.tableName || "");
                  setTableManageModalVisible(false);
                  setEditTableNameModalVisible(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className="bg-blue-600 py-4 rounded-lg flex-row items-center justify-center gap-2"
              >
                <Edit2 size={20} color="#fff" />
                <Text className="text-white text-center font-bold text-lg">Edit Table Name</Text>
              </Pressable>

              {/* Close/End Table */}
              <Pressable
                onPress={() => {
                  if (managingTable) {
                    endTableMutation.mutate(managingTable.id);
                  }
                }}
                disabled={endTableMutation.isPending}
                className={`bg-orange-600 py-4 rounded-lg flex-row items-center justify-center gap-2 ${
                  endTableMutation.isPending && "opacity-50"
                }`}
              >
                <Power size={20} color="#fff" />
                <Text className="text-white text-center font-bold text-lg">
                  {endTableMutation.isPending ? "Closing..." : "Close Table"}
                </Text>
              </Pressable>

              {/* Delete Table */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert(
                    "Delete Table",
                    `Are you sure you want to delete ${managingTable?.tableName}? All data will be permanently removed.`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          if (managingTable) {
                            deleteTableMutation.mutate(managingTable.id);
                          }
                        },
                      },
                    ]
                  );
                }}
                disabled={deleteTableMutation.isPending}
                className={`bg-red-600/20 border border-red-600 py-4 rounded-lg flex-row items-center justify-center gap-2 ${
                  deleteTableMutation.isPending && "opacity-50"
                }`}
              >
                <Trash2 size={20} color="#ef4444" />
                <Text className="text-red-500 text-center font-bold text-lg">
                  {deleteTableMutation.isPending ? "Deleting..." : "Delete Table"}
                </Text>
              </Pressable>

              {/* Cancel */}
              <Pressable
                onPress={() => {
                  setTableManageModalVisible(false);
                  setManagingTable(null);
                }}
                className="py-4 rounded-lg"
              >
                <Text className="text-slate-400 text-center font-medium text-lg">Cancel</Text>
              </Pressable>
            </View>

            <View className="mt-4 p-4 bg-slate-800 rounded-lg">
              <Text className="text-slate-400 text-xs">
                <Text className="font-bold">Tip:</Text> Long press any table name to manage it
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Table Name Modal */}
      <Modal visible={editTableNameModalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end">
          <Pressable
            className="flex-1 bg-black/50"
            onPress={() => {
              setEditTableNameModalVisible(false);
              setEditingTableName("");
              // Restore table manage modal
              setTableManageModalVisible(true);
            }}
          />
          <View className="bg-slate-900 rounded-t-3xl p-6 border-t border-slate-700">
            <Text className="text-white text-2xl font-bold mb-6">Edit Table Name</Text>

            <View className="gap-4">
              <View>
                <Text className="text-slate-400 text-sm mb-2 font-medium">Table Name</Text>
                <TextInput
                  value={editingTableName}
                  onChangeText={setEditingTableName}
                  placeholder="e.g., Table 1, High Stakes, Tournament"
                  placeholderTextColor="#475569"
                  className="bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700"
                  autoFocus
                />
              </View>

              <Pressable
                onPress={() => {
                  if (editingTableName.trim() && managingTable) {
                    updateTableNameMutation.mutate({
                      id: managingTable.id,
                      tableName: editingTableName.trim(),
                    });
                  }
                }}
                disabled={!editingTableName.trim() || updateTableNameMutation.isPending}
                className={`bg-blue-600 py-4 rounded-lg flex-row items-center justify-center gap-2 ${
                  (!editingTableName.trim() || updateTableNameMutation.isPending) && "opacity-50"
                }`}
              >
                <Edit2 size={20} color="#fff" />
                <Text className="text-white text-center font-bold text-lg">
                  {updateTableNameMutation.isPending ? "Updating..." : "Update Name"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setEditTableNameModalVisible(false);
                  setEditingTableName("");
                  setTableManageModalVisible(true);
                }}
                className="py-4 rounded-lg"
              >
                <Text className="text-slate-400 text-center font-medium text-lg">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
