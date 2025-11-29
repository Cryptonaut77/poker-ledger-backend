import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { LayoutDashboard, Users, Dices, Receipt, Archive } from "lucide-react-native";

import type { BottomTabParamList, RootStackParamList } from "@/navigation/types";
import DashboardScreen from "@/screens/DashboardScreen";
import PlayersScreen from "@/screens/PlayersScreen";
import DealersScreen from "@/screens/DealersScreen";
import ExpensesScreen from "@/screens/ExpensesScreen";
import GameHistoryScreen from "@/screens/GameHistoryScreen";
import LoginModalScreen from "@/screens/LoginModalScreen";

/**
 * RootStackNavigator
 * The root navigator for the app, which contains the bottom tab navigator
 */
const RootStack = createNativeStackNavigator<RootStackParamList>();
const RootNavigator = () => {
  return (
    <RootStack.Navigator>
      <RootStack.Screen
        name="Tabs"
        component={BottomTabNavigator}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="LoginModalScreen"
        component={LoginModalScreen}
        options={{ presentation: "modal", title: "Login" }}
      />
    </RootStack.Navigator>
  );
};

/**
 * BottomTabNavigator
 * The bottom tab navigator for poker game management
 */
const BottomTab = createBottomTabNavigator<BottomTabParamList>();
const BottomTabNavigator = () => {
  return (
    <BottomTab.Navigator
      initialRouteName="DashboardTab"
      screenOptions={{
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          borderTopColor: "#1a5742",
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: "#10b981",
        tabBarInactiveTintColor: "#94a3b8",
        headerStyle: {
          backgroundColor: "#0f172a",
        },
        headerTintColor: "#fff",
      }}
      screenListeners={() => ({
        transitionStart: () => {
          Haptics.selectionAsync();
        },
      })}
    >
      <BottomTab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <BottomTab.Screen
        name="PlayersTab"
        component={PlayersScreen}
        options={{
          title: "Players",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <BottomTab.Screen
        name="DealersTab"
        component={DealersScreen}
        options={{
          title: "Dealers",
          tabBarIcon: ({ color, size }) => <Dices size={size} color={color} />,
        }}
      />
      <BottomTab.Screen
        name="ExpensesTab"
        component={ExpensesScreen}
        options={{
          title: "Expenses",
          tabBarIcon: ({ color, size }) => <Receipt size={size} color={color} />,
        }}
      />
      <BottomTab.Screen
        name="HistoryTab"
        component={GameHistoryScreen}
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => <Archive size={size} color={color} />,
        }}
      />
    </BottomTab.Navigator>
  );
};

export default RootNavigator;
