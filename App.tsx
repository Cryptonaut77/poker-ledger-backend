import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { queryClient } from "@/lib/queryClient";
import RootStackNavigator from "@/navigation/RootNavigator";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { QueryClientProvider } from "@tanstack/react-query";
import NetworkStatusBanner from "@/components/NetworkStatusBanner";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";

/*
IMPORTANT NOTICE: DO NOT REMOVE
There are already environment keys in the project. 
Before telling the user to add them, check if you already have access to the required keys through bash.
Directly access them with process.env.${key}

Correct usage:
process.env.EXPO_PUBLIC_VIBECODE_{key}
//directly access the key

Incorrect usage:
import { OPENAI_API_KEY } from '@env';
//don't use @env, its depreicated

Incorrect usage:
import Constants from 'expo-constants';
const openai_api_key = Constants.expoConfig.extra.apikey;
//don't use expo-constants, its depreicated

*/

// Deep linking configuration
const linking = {
  prefixes: [Linking.createURL("/"), "vibecode://"],
  config: {
    screens: {
      Tabs: {
        path: "tabs",
        screens: {
          DashboardTab: "dashboard",
          PlayersTab: "players",
          DealersTab: "dealers",
          ExpensesTab: "expenses",
          HistoryTab: "history",
        },
      },
      ShareGameScreen: {
        path: "share",
        parse: {
          code: (code: string) => code,
        },
      },
      LoginModalScreen: "login",
    },
  },
};

// Inner component that can use hooks
function AppContent() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <View style={{ height: insets.top, backgroundColor: "#0f172a" }} />
      <NetworkStatusBanner />
      <View style={{ flex: 1 }}>
        <NavigationContainer linking={linking}>
          <RootStackNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <KeyboardProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AppContent />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </KeyboardProvider>
    </QueryClientProvider>
  );
}
