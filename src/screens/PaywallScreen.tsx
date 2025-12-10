import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { X, Check, Crown } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as RevenueCat from "@/lib/revenuecatClient";
import type { PurchasesPackage } from "react-native-purchases";

export default function PaywallScreen() {
  const navigation = useNavigation();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const offeringsResult = await RevenueCat.getOfferings();

      if (offeringsResult.ok && offeringsResult.data.current && offeringsResult.data.current.availablePackages.length > 0) {
        const pkgs = offeringsResult.data.current.availablePackages;
        setPackages(pkgs);

        // Default to yearly package if available
        const yearly = pkgs.find((pkg: PurchasesPackage) => pkg.identifier === "$rc_annual");
        setSelectedPackage(yearly || pkgs[0]);
      }
    } catch (error) {
      console.error("Error loading packages:", error);
      Alert.alert("Error", "Failed to load subscription plans");
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    try {
      setPurchasing(true);
      const purchaseResult = await RevenueCat.purchasePackage(selectedPackage);

      if (purchaseResult.ok && purchaseResult.data.entitlements.active["premium"]) {
        Alert.alert(
          "Success!",
          "You now have unlimited access to all features!",
          [{ text: "Continue", onPress: () => navigation.goBack() }]
        );
      }
    } catch (error: any) {
      if (!error.userCancelled) {
        console.error("Purchase error:", error);
        Alert.alert("Purchase Failed", "There was an error processing your purchase. Please try again.");
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setPurchasing(true);
      const customerInfoResult = await RevenueCat.restorePurchases();

      if (customerInfoResult.ok && customerInfoResult.data.entitlements.active["premium"]) {
        Alert.alert(
          "Success!",
          "Your subscription has been restored!",
          [{ text: "Continue", onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert("No Subscription Found", "We couldn't find an active subscription for this account.");
      }
    } catch (error) {
      console.error("Restore error:", error);
      Alert.alert("Restore Failed", "There was an error restoring your purchase. Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  const getPackagePrice = (pkg: PurchasesPackage) => {
    return pkg.product.priceString;
  };

  const getPackageSavings = (pkg: PurchasesPackage) => {
    if (pkg.identifier === "$rc_annual") {
      // Yearly is $72, monthly is $9.99 * 12 = $119.88
      // Savings: $47.88 (~40% off)
      return "Save 40%";
    }
    return null;
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-900 items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-900">
      <LinearGradient
        colors={["#1e293b", "#0f172a"]}
        style={{ flex: 1 }}
      >
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Header */}
          <View className="px-6 pt-16 pb-8">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="self-end mb-4"
              disabled={purchasing}
            >
              <X size={28} color="#94a3b8" />
            </TouchableOpacity>

            <View className="items-center mb-6">
              <View className="w-20 h-20 bg-amber-500/20 rounded-full items-center justify-center mb-4">
                <Crown size={40} color="#f59e0b" />
              </View>
              <Text className="text-white text-3xl font-bold text-center mb-2">
                Upgrade to Premium
              </Text>
              <Text className="text-slate-400 text-lg text-center">
                Continue managing unlimited poker games
              </Text>
            </View>
          </View>

          {/* Features */}
          <View className="px-6 mb-8">
            <View className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <Text className="text-white text-xl font-semibold mb-4">Premium Features</Text>

              <View className="space-y-4">
                <View className="flex-row items-start">
                  <View className="w-6 h-6 bg-green-500/20 rounded-full items-center justify-center mr-3 mt-0.5">
                    <Check size={16} color="#22c55e" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-base">Unlimited Games</Text>
                    <Text className="text-slate-400 text-sm">Track as many poker games as you want</Text>
                  </View>
                </View>

                <View className="flex-row items-start">
                  <View className="w-6 h-6 bg-green-500/20 rounded-full items-center justify-center mr-3 mt-0.5">
                    <Check size={16} color="#22c55e" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-base">Cloud Sync</Text>
                    <Text className="text-slate-400 text-sm">Access your data from any device</Text>
                  </View>
                </View>

                <View className="flex-row items-start">
                  <View className="w-6 h-6 bg-green-500/20 rounded-full items-center justify-center mr-3 mt-0.5">
                    <Check size={16} color="#22c55e" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-base">Team Collaboration</Text>
                    <Text className="text-slate-400 text-sm">Share games with unlimited members</Text>
                  </View>
                </View>

                <View className="flex-row items-start">
                  <View className="w-6 h-6 bg-green-500/20 rounded-full items-center justify-center mr-3 mt-0.5">
                    <Check size={16} color="#22c55e" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-base">Priority Support</Text>
                    <Text className="text-slate-400 text-sm">Get help when you need it</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Package Selection */}
          <View className="px-6 mb-8">
            <Text className="text-white text-xl font-semibold mb-4">Choose Your Plan</Text>

            <View className="space-y-3">
              {packages.map((pkg) => {
                const isSelected = selectedPackage?.identifier === pkg.identifier;
                const isYearly = pkg.identifier === "$rc_annual";
                const savings = getPackageSavings(pkg);

                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    onPress={() => setSelectedPackage(pkg)}
                    disabled={purchasing}
                    className={`rounded-2xl p-5 border-2 ${
                      isSelected
                        ? "bg-blue-500/20 border-blue-500"
                        : "bg-slate-800/50 border-slate-700"
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <View className="flex-row items-center mb-1">
                          <Text className={`text-lg font-bold ${isSelected ? "text-blue-400" : "text-white"}`}>
                            {isYearly ? "Yearly" : "Monthly"}
                          </Text>
                          {savings && (
                            <View className="ml-2 bg-green-500/20 px-2 py-1 rounded-full">
                              <Text className="text-green-400 text-xs font-semibold">{savings}</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-slate-400 text-sm">
                          {getPackagePrice(pkg)}
                          {isYearly ? "/year" : "/month"}
                        </Text>
                      </View>

                      <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                        isSelected ? "bg-blue-500 border-blue-500" : "border-slate-600"
                      }`}>
                        {isSelected && <Check size={16} color="white" />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Purchase Button */}
          <View className="px-6 mb-4">
            <TouchableOpacity
              onPress={handlePurchase}
              disabled={!selectedPackage || purchasing}
              className="bg-blue-600 rounded-2xl py-4 items-center"
            >
              {purchasing ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-lg font-bold">
                  Subscribe Now
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Restore Button */}
          <View className="px-6">
            <TouchableOpacity
              onPress={handleRestore}
              disabled={purchasing}
              className="py-3 items-center"
            >
              <Text className="text-blue-400 text-base font-semibold">
                Restore Purchase
              </Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <View className="px-6 mt-4">
            <Text className="text-slate-500 text-xs text-center leading-5">
              Subscriptions will be charged to your iTunes account. Auto-renewal may be turned off in Account Settings.
              Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period.
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}
