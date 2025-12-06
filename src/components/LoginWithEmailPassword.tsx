import React, { useState, useEffect } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { Dices, Check, Eye, EyeOff } from "lucide-react-native";
import * as SecureStore from "expo-secure-store";

import { authClient } from "@/lib/authClient";
import { useSession } from "@/lib/useSession";

const REMEMBERED_EMAIL_KEY = "poker_remembered_email";
const REMEMBERED_PASSWORD_KEY = "poker_remembered_password";
const REMEMBER_CREDENTIALS_KEY = "poker_remember_credentials";

export default function LoginWithEmailPassword() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberCredentials, setRememberCredentials] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const { data: session } = useSession();

  // Load remembered credentials on mount
  useEffect(() => {
    const loadRememberedCredentials = async () => {
      try {
        const savedEmail = await SecureStore.getItemAsync(REMEMBERED_EMAIL_KEY);
        const savedPassword = await SecureStore.getItemAsync(REMEMBERED_PASSWORD_KEY);
        const shouldRemember = await SecureStore.getItemAsync(REMEMBER_CREDENTIALS_KEY);

        if (savedEmail) {
          setEmail(savedEmail);
        }
        if (savedPassword) {
          setPassword(savedPassword);
        }
        if (shouldRemember !== null) {
          setRememberCredentials(shouldRemember === "true");
        }
      } catch (error) {
        console.log("Failed to load remembered credentials:", error);
      }
    };
    loadRememberedCredentials();
  }, []);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    setIsLoading(true);
    try {
      // Save credentials if remember is enabled
      if (rememberCredentials) {
        await SecureStore.setItemAsync(REMEMBERED_EMAIL_KEY, email);
        await SecureStore.setItemAsync(REMEMBERED_PASSWORD_KEY, password);
        await SecureStore.setItemAsync(REMEMBER_CREDENTIALS_KEY, "true");
      } else {
        await SecureStore.deleteItemAsync(REMEMBERED_EMAIL_KEY);
        await SecureStore.deleteItemAsync(REMEMBERED_PASSWORD_KEY);
        await SecureStore.setItemAsync(REMEMBER_CREDENTIALS_KEY, "false");
      }

      console.log("[Auth] Attempting sign in for:", email);
      console.log("[Auth] Backend URL:", process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL);

      const result = await authClient.signIn.email({
        email,
        password,
      });

      console.log("[Auth] Sign in result:", JSON.stringify(result, null, 2));

      if (result.error) {
        console.log("[Auth] Sign in error:", result.error);
        Alert.alert("Sign In Failed", result.error.message || "Please check your credentials");
      }
    } catch (error) {
      console.error("[Auth] Sign in exception:", error);
      Alert.alert("Error", "An unexpected error occurred. Check logs for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !name) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      console.log("[Auth] Attempting sign up for:", email);
      console.log("[Auth] Backend URL:", process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL);

      const result = await authClient.signUp.email({
        email,
        password,
        name,
      });

      console.log("[Auth] Sign up result:", JSON.stringify(result, null, 2));

      if (result.error) {
        console.log("[Auth] Sign up error:", result.error);
        Alert.alert("Sign Up Failed", result.error.message || "Please try again");
      } else {
        Alert.alert("Welcome!", "Your account has been created. You're now signed in.");
        setEmail("");
        setPassword("");
        setName("");
      }
    } catch (error) {
      console.error("[Auth] Sign up exception:", error);
      Alert.alert("Error", "An unexpected error occurred. Check logs for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
    } catch (error) {
      Alert.alert("Error", "Failed to sign out");
      console.error(error);
    }
  };

  // If user is already logged in, show account info and sign out button
  if (session) {
    return (
      <View className="flex-1 bg-slate-900">
        <SafeAreaView edges={["top"]} className="flex-1">
          <KeyboardAwareScrollView className="flex-1">
            <View className="w-full p-6 gap-6">
              <View className="items-center pt-8 pb-4">
                <View className="w-20 h-20 rounded-full bg-emerald-600 items-center justify-center mb-4">
                  <Text className="text-3xl font-bold text-white">
                    {session.user.name?.charAt(0).toUpperCase() || "U"}
                  </Text>
                </View>
                <Text className="text-2xl font-bold text-white">{session.user.name}</Text>
                <Text className="text-slate-400 mt-1">{session.user.email}</Text>
              </View>

              <View className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <Text className="text-slate-400 text-sm mb-1">Account Status</Text>
                <Text className="text-emerald-400 font-semibold">Active</Text>
              </View>

              <Pressable
                onPress={handleSignOut}
                className="bg-red-600 p-4 rounded-xl items-center active:bg-red-700"
              >
                <Text className="text-white font-semibold text-base">Sign Out</Text>
              </Pressable>
            </View>
          </KeyboardAwareScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-900">
      <SafeAreaView edges={["top"]} className="flex-1">
        <KeyboardAwareScrollView className="flex-1">
          <View className="w-full p-6 gap-5">
            {/* Header */}
            <View className="items-center pt-12 pb-6">
              <View className="w-20 h-20 rounded-2xl bg-emerald-600 items-center justify-center mb-4">
                <Dices size={40} color="#fff" />
              </View>
              <Text className="text-3xl font-bold text-white mb-2">Poker Manager</Text>
              <Text className="text-slate-400 text-center">
                {isSignUp ? "Create an account to get started" : "Sign in to manage your games"}
              </Text>
            </View>

            {/* Form */}
            <View className="gap-4">
              {isSignUp && (
                <View>
                  <Text className="text-sm font-medium mb-2 text-slate-300">Name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter your name"
                    placeholderTextColor="#64748b"
                    className="border border-slate-600 rounded-xl p-4 bg-slate-800 text-white"
                    autoCapitalize="words"
                    editable={!isLoading}
                  />
                </View>
              )}

              <View>
                <Text className="text-sm font-medium mb-2 text-slate-300">Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor="#64748b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="border border-slate-600 rounded-xl p-4 bg-slate-800 text-white"
                  editable={!isLoading}
                />
              </View>

              <View>
                <Text className="text-sm font-medium mb-2 text-slate-300">Password</Text>
                <View className="flex-row items-center border border-slate-600 rounded-xl bg-slate-800">
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor="#64748b"
                    secureTextEntry={!showPassword}
                    className="flex-1 p-4 text-white"
                    editable={!isLoading}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    className="px-4 py-4"
                  >
                    {showPassword ? (
                      <EyeOff size={20} color="#94a3b8" />
                    ) : (
                      <Eye size={20} color="#94a3b8" />
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Remember Credentials Checkbox */}
              {!isSignUp && (
                <Pressable
                  onPress={() => setRememberCredentials(!rememberCredentials)}
                  className="flex-row items-center gap-3 py-2"
                >
                  <View className={`w-6 h-6 rounded border-2 items-center justify-center ${rememberCredentials ? "bg-emerald-600 border-emerald-600" : "border-slate-500"}`}>
                    {rememberCredentials && <Check size={16} color="#fff" />}
                  </View>
                  <Text className="text-slate-300">Remember my login</Text>
                </Pressable>
              )}
            </View>

            {/* Submit Button */}
            <Pressable
              onPress={isSignUp ? handleSignUp : handleSignIn}
              disabled={isLoading}
              className={`p-4 rounded-xl items-center mt-2 ${isLoading ? "bg-emerald-800" : "bg-emerald-600 active:bg-emerald-700"}`}
            >
              <Text className="text-white font-semibold text-base">
                {isLoading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
              </Text>
            </Pressable>

            {/* Toggle Sign Up / Sign In */}
            <Pressable
              onPress={() => setIsSignUp(!isSignUp)}
              disabled={isLoading}
              className="items-center py-4"
            >
              <Text className="text-emerald-400 text-sm">
                {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </View>
  );
}
