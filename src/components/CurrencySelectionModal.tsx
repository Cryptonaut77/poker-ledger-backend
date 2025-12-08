import React from "react";
import { View, Text, Modal, Pressable, ScrollView } from "react-native";
import { X, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";

interface Currency {
  code: string;
  name: string;
  symbol: string;
}

const CURRENCIES: Currency[] = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "AED", name: "UAE Dirham", symbol: "AED" },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR" },
  { code: "PLN", name: "Polish Złoty", symbol: "zł" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺" },
];

interface CurrencySelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (currency: Currency) => void;
  selectedCurrency?: string;
}

const CurrencySelectionModal = ({
  visible,
  onClose,
  onSelect,
  selectedCurrency = "USD",
}: CurrencySelectionModalProps) => {
  console.log("[CurrencyModal] Rendering - visible:", visible, "selectedCurrency:", selectedCurrency);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          className="flex-1"
          onPress={() => {
            console.log("[CurrencyModal] Background pressed - closing");
            onClose();
          }}
        />
        <View className="bg-slate-900 rounded-t-3xl border-t border-slate-700" style={{ maxHeight: '80%' }}>
          {/* Header */}
          <View className="flex-row items-center justify-between p-6 border-b border-slate-800">
            <Text className="text-white text-2xl font-bold">Select Currency</Text>
            <Pressable
              onPress={() => {
                console.log("[CurrencyModal] Close button pressed");
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              className="bg-slate-800 p-2 rounded-lg"
            >
              <X size={20} color="#fff" />
            </Pressable>
          </View>

          {/* Currency List */}
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
            showsVerticalScrollIndicator={true}
          >
            <View className="gap-2">
              {CURRENCIES.map((currency) => (
                <Pressable
                  key={currency.code}
                  onPress={() => {
                    console.log("[CurrencyModal] Currency pressed:", currency.code);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelect(currency);
                  }}
                  className={`p-4 rounded-xl flex-row items-center justify-between ${
                    selectedCurrency === currency.code
                      ? "bg-emerald-600"
                      : "bg-slate-800"
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <Text
                      className={`text-2xl font-bold ${
                        selectedCurrency === currency.code
                          ? "text-white"
                          : "text-slate-400"
                      }`}
                    >
                      {currency.symbol}
                    </Text>
                    <View>
                      <Text
                        className={`text-lg font-bold ${
                          selectedCurrency === currency.code
                            ? "text-white"
                            : "text-slate-200"
                        }`}
                      >
                        {currency.code}
                      </Text>
                      <Text
                        className={`text-sm ${
                          selectedCurrency === currency.code
                            ? "text-emerald-100"
                            : "text-slate-400"
                        }`}
                      >
                        {currency.name}
                      </Text>
                    </View>
                  </View>
                  {selectedCurrency === currency.code && (
                    <Check size={24} color="#fff" />
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export { CurrencySelectionModal, CURRENCIES };
export type { Currency };
