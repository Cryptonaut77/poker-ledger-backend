import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import type { RootStackScreenProps } from "@/navigation/types";

type Props = RootStackScreenProps<"HelpScreen">;

interface HelpSection {
  title: string;
  content: string[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: "Getting Started",
    content: [
      "The app automatically creates your first game when you open it.",
      "All transactions, dealer tips, and expenses are tracked within each game session.",
      "You can view real-time statistics on the Dashboard tab.",
    ],
  },
  {
    title: "Starting a New Game",
    content: [
      "1. Navigate to the Dashboard tab",
      "2. Tap the 'Manage' button in the top right",
      "3. Tap 'Start New Game'",
      "4. Select your preferred currency (USD, EUR, JPY, etc.)",
      "5. Your new game will start immediately with all stats reset",
    ],
  },
  {
    title: "Tracking Player Buy-ins",
    content: [
      "1. Go to the Players tab",
      "2. Tap the green '+' button",
      "3. Enter player name and amount",
      "4. Select payment method:",
      "   • Cash - Physical money (adds to Till Balance)",
      "   • Electronic - Digital payment (tracked separately)",
      "   • Credit - IOU/debt (tracked as owed amount)",
      "5. Add optional notes if needed",
      "6. Submit to record the buy-in",
    ],
  },
  {
    title: "Recording Cashouts",
    content: [
      "1. Go to the Players tab",
      "2. Tap the red '$' button",
      "3. Enter player name and cashout amount",
      "4. Select payment method",
      "5. If player has credit balance, it will be automatically settled",
      "6. Submit to record the cashout",
    ],
  },
  {
    title: "Managing Dealer Tips & Rake",
    content: [
      "1. Go to the Dealers tab",
      "2. Choose between 'Pay Dealers' (tips) or 'Claim Rake' tabs",
      "3. Tap '+' to add a dealer down",
      "4. Enter dealer name, tips, and rake amounts",
      "5. Dealer downs are grouped by dealer name",
      "6. Tap a dealer card to expand and see all their downs",
      "7. Mark tips as paid or rake as claimed when distributed",
    ],
  },
  {
    title: "Logging Expenses",
    content: [
      "1. Go to the Expenses tab",
      "2. Tap '+' to add an expense",
      "3. Enter description and amount",
      "4. Select category (Food, Drinks, Other)",
      "5. Select payment method (Cash or Electronic)",
      "6. Add optional notes",
      "7. Submit to record the expense",
    ],
  },
  {
    title: "Understanding the Dashboard",
    content: [
      "• Till Balance - Physical cash on hand (Cash buy-ins - Cashouts - Paid tips - Expenses)",
      "• House Profit - Business profit (Paid rake - Expenses)",
      "• Payment Method Balances - Shows net balance for each payment type",
      "• Cash (In Till) - Net cash that should be in the till",
      "• Electronic - Net electronic transactions",
      "• Credit (Owed) - Total amount owed by players on credit",
    ],
  },
  {
    title: "Credit/IOU System",
    content: [
      "When a player buys in on credit, the amount is tracked as owed.",
      "When they cash out, credit is automatically settled first:",
      "• If they owe $500 and cash out $800, you pay them $300 cash",
      "• The system creates two transactions: IOU settlement + Cash payment",
      "• Credit balance updates automatically",
    ],
  },
  {
    title: "Editing & Deleting",
    content: [
      "• Tap the blue edit icon on any transaction to modify or delete it",
      "• You can edit amounts, payment methods, and notes",
      "• Deleting is permanent - be careful!",
      "• All changes update the dashboard in real-time",
    ],
  },
  {
    title: "Game History",
    content: [
      "1. Go to the History tab to view past games",
      "2. Tap any game to expand and see full details",
      "3. View all transactions, tips, rake, and expenses",
      "4. Delete old games if needed (cannot be undone)",
    ],
  },
  {
    title: "Team Collaboration",
    content: [
      "1. Tap the blue 'Share' icon on the Dashboard",
      "2. Generate a share code or QR code",
      "3. Share the code with team members",
      "4. They can join and edit the game together",
      "5. Share codes expire after 24 hours",
      "6. Only the game owner can manage team members",
    ],
  },
  {
    title: "Tips & Best Practices",
    content: [
      "• Pull down on any screen to refresh data",
      "• Mark dealer tips/rake as paid immediately when distributed",
      "• Use notes to track important details",
      "• End and save games to keep a history",
      "• Check Till Balance at end of night to verify cash on hand",
      "• Credit balance shows total owed - collect before game ends",
    ],
  },
];

const HelpScreen = ({ navigation }: Props) => {
  const [expandedSections, setExpandedSections] = React.useState<Set<number>>(new Set([0]));

  const toggleSection = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <View className="flex-1 bg-slate-950">
      <SafeAreaView edges={["top"]} className="flex-1">
        {/* Header */}
        <View className="px-6 py-4 border-b border-slate-800">
          <Text className="text-white text-3xl font-bold">Help & Instructions</Text>
          <Text className="text-slate-400 text-sm mt-1">Learn how to use Poker Night Ledger</Text>
        </View>

        {/* Content */}
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          <View className="px-4 py-4 gap-3">
            {HELP_SECTIONS.map((section, index) => {
              const isExpanded = expandedSections.has(index);
              return (
                <View key={index} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  {/* Section Header */}
                  <Pressable
                    onPress={() => toggleSection(index)}
                    className="p-4 flex-row items-center justify-between"
                  >
                    <Text className="text-white text-lg font-bold flex-1">{section.title}</Text>
                    {isExpanded ? (
                      <ChevronDown size={24} color="#94a3b8" />
                    ) : (
                      <ChevronRight size={24} color="#94a3b8" />
                    )}
                  </Pressable>

                  {/* Section Content */}
                  {isExpanded && (
                    <View className="px-4 pb-4 border-t border-slate-800">
                      {section.content.map((line, lineIndex) => (
                        <Text key={lineIndex} className="text-slate-300 text-sm leading-6 mt-2">
                          {line}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Footer */}
          <View className="px-4 mt-4 mb-8">
            <View className="bg-slate-900 rounded-xl p-6 border border-slate-800">
              <Text className="text-white text-lg font-bold mb-2">Need More Help?</Text>
              <Text className="text-slate-400 text-sm leading-6">
                If you have questions or need assistance, check the app settings or reach out to support. We&apos;re here to help you run smooth poker games!
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default HelpScreen;
