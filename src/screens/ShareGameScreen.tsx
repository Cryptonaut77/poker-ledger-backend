import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, UserPlus, Users, RefreshCw, Trash2, X, Check } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

import { api } from "@/lib/api";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ShareGameScreen">;

type ShareMembersResponse = {
  owner: { id: string; name: string | null; email: string; initials: string | null; role: string } | null;
  members: Array<{ id: string; name: string | null; email: string; initials: string | null; role: string; joinedAt: string }>;
  shareCode: string | null;
  shareCodeExpiresAt: string | null;
};

type GenerateShareCodeResponse = {
  shareCode: string;
  expiresAt: string;
};

type JoinGameResponse = {
  success: boolean;
  gameName: string;
  ownerName: string | null;
};

const ShareGameScreen = ({ navigation }: Props) => {
  const queryClient = useQueryClient();
  const [joinCode, setJoinCode] = useState("");
  const [showJoinForm, setShowJoinForm] = useState(false);

  // Fetch current share info
  const { data: shareData, isLoading } = useQuery({
    queryKey: ["shareMembers"],
    queryFn: () => api.get<ShareMembersResponse>("/api/share/members"),
    retry: 2,
  });

  // Generate share code mutation
  const generateCodeMutation = useMutation({
    mutationFn: () => api.post<GenerateShareCodeResponse>("/api/share/generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shareMembers"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to generate share code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  // Join game mutation
  const joinGameMutation = useMutation({
    mutationFn: (shareCode: string) => api.post<JoinGameResponse>("/api/share/join", { shareCode }),
    onSuccess: (data) => {
      Alert.alert("Success", `You've joined ${data.gameName}!`);
      queryClient.invalidateQueries({ queryKey: ["shareMembers"] });
      queryClient.invalidateQueries({ queryKey: ["activeGame"] });
      setJoinCode("");
      setShowJoinForm(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Invalid share code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  // Revoke share code mutation
  const revokeCodeMutation = useMutation({
    mutationFn: () => api.delete("/api/share/code"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shareMembers"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to revoke share code");
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/api/share/member/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shareMembers"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to remove member");
    },
  });

  const copyShareCode = async () => {
    if (shareData?.shareCode) {
      await Clipboard.setStringAsync(shareData.shareCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Copied!", "Share code copied to clipboard");
    }
  };

  const shareCode = async () => {
    if (shareData?.shareCode) {
      try {
        await Share.share({
          message: `Join my poker game! Use code: ${shareData.shareCode}`,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    }
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return "";
    const date = new Date(expiresAt);
    const now = new Date();
    const hoursLeft = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60));
    if (hoursLeft <= 0) return "Expired";
    if (hoursLeft === 1) return "Expires in 1 hour";
    return `Expires in ${hoursLeft} hours`;
  };

  const isOwner = shareData?.owner?.role === "owner";

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950">
      <SafeAreaView edges={["top"]} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-800">
          <Pressable onPress={() => navigation.goBack()} className="p-2">
            <X size={24} color="#94a3b8" />
          </Pressable>
          <Text className="text-white text-lg font-bold">Share Game</Text>
          <View className="w-10" />
        </View>

        <View className="flex-1 p-4">
          {/* Share Code Section - Only for owners */}
          {isOwner && (
            <View className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-4">
              <View className="flex-row items-center gap-2 mb-4">
                <UserPlus size={20} color="#10b981" />
                <Text className="text-white text-lg font-bold">Invite Coworkers</Text>
              </View>

              {shareData?.shareCode ? (
                <View>
                  <Text className="text-slate-400 text-sm mb-2">Share this code with your team:</Text>
                  <View className="bg-slate-800 rounded-lg p-4 mb-2">
                    <Text className="text-emerald-400 text-3xl font-bold text-center tracking-widest">
                      {shareData.shareCode}
                    </Text>
                  </View>
                  <Text className="text-slate-500 text-xs text-center mb-4">
                    {formatExpiry(shareData.shareCodeExpiresAt)}
                  </Text>

                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={copyShareCode}
                      className="flex-1 bg-slate-700 py-3 rounded-lg flex-row items-center justify-center gap-2"
                    >
                      <Copy size={18} color="#fff" />
                      <Text className="text-white font-semibold">Copy</Text>
                    </Pressable>
                    <Pressable
                      onPress={shareCode}
                      className="flex-1 bg-emerald-600 py-3 rounded-lg flex-row items-center justify-center gap-2"
                    >
                      <UserPlus size={18} color="#fff" />
                      <Text className="text-white font-semibold">Share</Text>
                    </Pressable>
                  </View>

                  <View className="flex-row gap-2 mt-2">
                    <Pressable
                      onPress={() => generateCodeMutation.mutate()}
                      disabled={generateCodeMutation.isPending}
                      className="flex-1 bg-slate-800 py-3 rounded-lg flex-row items-center justify-center gap-2"
                    >
                      <RefreshCw size={18} color="#94a3b8" />
                      <Text className="text-slate-300 font-semibold">New Code</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Alert.alert("Revoke Code", "This will invalidate the current share code.", [
                          { text: "Cancel", style: "cancel" },
                          { text: "Revoke", style: "destructive", onPress: () => revokeCodeMutation.mutate() },
                        ]);
                      }}
                      disabled={revokeCodeMutation.isPending}
                      className="flex-1 bg-red-900/30 border border-red-800 py-3 rounded-lg flex-row items-center justify-center gap-2"
                    >
                      <Trash2 size={18} color="#ef4444" />
                      <Text className="text-red-400 font-semibold">Revoke</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View>
                  <Text className="text-slate-400 text-sm mb-4">
                    Generate a share code so your team can join and make entries in this game.
                  </Text>
                  <Pressable
                    onPress={() => generateCodeMutation.mutate()}
                    disabled={generateCodeMutation.isPending}
                    className={`bg-emerald-600 py-4 rounded-lg flex-row items-center justify-center gap-2 ${
                      generateCodeMutation.isPending && "opacity-50"
                    }`}
                  >
                    <UserPlus size={20} color="#fff" />
                    <Text className="text-white font-bold text-lg">
                      {generateCodeMutation.isPending ? "Generating..." : "Generate Share Code"}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Join Game Section - For non-owners */}
          {!isOwner && (
            <View className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-4">
              <View className="flex-row items-center gap-2 mb-4">
                <UserPlus size={20} color="#3b82f6" />
                <Text className="text-white text-lg font-bold">Join a Game</Text>
              </View>

              {showJoinForm ? (
                <View>
                  <Text className="text-slate-400 text-sm mb-2">Enter the 6-character share code:</Text>
                  <TextInput
                    value={joinCode}
                    onChangeText={(text) => setJoinCode(text.toUpperCase())}
                    placeholder="XXXXXX"
                    placeholderTextColor="#475569"
                    className="bg-slate-800 text-white text-2xl font-bold text-center px-4 py-4 rounded-lg border border-slate-700 tracking-widest mb-4"
                    maxLength={6}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => {
                        setShowJoinForm(false);
                        setJoinCode("");
                      }}
                      className="flex-1 bg-slate-700 py-3 rounded-lg"
                    >
                      <Text className="text-white text-center font-semibold">Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => joinGameMutation.mutate(joinCode)}
                      disabled={joinCode.length !== 6 || joinGameMutation.isPending}
                      className={`flex-1 bg-blue-600 py-3 rounded-lg ${
                        (joinCode.length !== 6 || joinGameMutation.isPending) && "opacity-50"
                      }`}
                    >
                      <Text className="text-white text-center font-semibold">
                        {joinGameMutation.isPending ? "Joining..." : "Join Game"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => setShowJoinForm(true)}
                  className="bg-blue-600 py-4 rounded-lg flex-row items-center justify-center gap-2"
                >
                  <UserPlus size={20} color="#fff" />
                  <Text className="text-white font-bold text-lg">Enter Share Code</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Team Members Section */}
          <View className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <View className="flex-row items-center gap-2 mb-4">
              <Users size={20} color="#f59e0b" />
              <Text className="text-white text-lg font-bold">Team Members</Text>
            </View>

            {/* Owner */}
            {shareData?.owner && (
              <View className="flex-row items-center justify-between py-3 border-b border-slate-800">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-full bg-emerald-600 items-center justify-center">
                    <Text className="text-white font-bold">
                      {shareData.owner.initials || shareData.owner.name?.charAt(0) || "?"}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-white font-semibold">{shareData.owner.name || "Unknown"}</Text>
                    <Text className="text-slate-500 text-xs">{shareData.owner.email}</Text>
                  </View>
                </View>
                <View className="bg-emerald-900/30 px-3 py-1 rounded-full border border-emerald-700/50">
                  <Text className="text-emerald-400 text-xs font-medium">Owner</Text>
                </View>
              </View>
            )}

            {/* Members */}
            {shareData?.members && shareData.members.length > 0 ? (
              shareData.members.map((member) => (
                <View key={member.id} className="flex-row items-center justify-between py-3 border-b border-slate-800">
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-full bg-blue-600 items-center justify-center">
                      <Text className="text-white font-bold">
                        {member.initials || member.name?.charAt(0) || "?"}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-white font-semibold">{member.name || "Unknown"}</Text>
                      <Text className="text-slate-500 text-xs">{member.email}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <View className="bg-blue-900/30 px-3 py-1 rounded-full border border-blue-700/50">
                      <Text className="text-blue-400 text-xs font-medium">Editor</Text>
                    </View>
                    {isOwner && (
                      <Pressable
                        onPress={() => {
                          Alert.alert("Remove Member", `Remove ${member.name || member.email} from this game?`, [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Remove",
                              style: "destructive",
                              onPress: () => removeMemberMutation.mutate(member.id),
                            },
                          ]);
                        }}
                        className="p-2"
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </Pressable>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View className="py-6">
                <Text className="text-slate-500 text-center">No team members yet</Text>
                <Text className="text-slate-600 text-center text-sm mt-1">
                  {isOwner ? "Generate a share code to invite your team" : "Ask the game owner for a share code"}
                </Text>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default ShareGameScreen;
