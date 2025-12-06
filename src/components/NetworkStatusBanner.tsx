import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";
import { WifiOff, RefreshCw } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
} from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";

/**
 * NetworkStatusBanner
 * Shows a banner when the app is offline or having connection issues
 * Allows user to manually retry the connection
 */
const NetworkStatusBanner = () => {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(onlineManager.isOnline());
  const [isRetrying, setIsRetrying] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  // Subscribe to online status changes
  useEffect(() => {
    const unsubscribe = onlineManager.subscribe((online) => {
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, []);
  const rotation = useSharedValue(0);

  useEffect(() => {
    // Show banner when offline
    if (!isOnline) {
      setShowBanner(true);
    } else {
      // Hide banner after a short delay when back online
      const timer = setTimeout(() => setShowBanner(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  useEffect(() => {
    if (isRetrying) {
      rotation.value = withRepeat(withTiming(360, { duration: 1000 }), -1, false);
    } else {
      rotation.value = 0;
    }
  }, [isRetrying]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      // Check network state
      const networkState = await Network.getNetworkStateAsync();
      if (networkState.isConnected) {
        // Invalidate all queries to refetch data
        await queryClient.invalidateQueries();
      }
    } catch (error) {
      console.log("Retry failed:", error);
    } finally {
      setIsRetrying(false);
    }
  };

  if (!showBanner) return null;

  return (
    <View className="bg-amber-600 px-4 py-3 flex-row items-center justify-between">
      <View className="flex-row items-center gap-2 flex-1">
        <WifiOff size={18} color="#fff" />
        <Text className="text-white font-medium text-sm flex-1">
          {isOnline ? "Reconnected! Syncing..." : "Connection interrupted"}
        </Text>
      </View>
      {!isOnline && (
        <Pressable
          onPress={handleRetry}
          disabled={isRetrying}
          className="bg-amber-700 px-3 py-1.5 rounded-lg flex-row items-center gap-1"
        >
          <Animated.View style={animatedStyle}>
            <RefreshCw size={14} color="#fff" />
          </Animated.View>
          <Text className="text-white text-xs font-medium">
            {isRetrying ? "Retrying..." : "Retry"}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

export default NetworkStatusBanner;
