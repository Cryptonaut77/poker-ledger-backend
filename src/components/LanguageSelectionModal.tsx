import React from "react";
import { View, Text, Modal, Pressable, ScrollView } from "react-native";
import { X, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";

interface Language {
  code: string;
  name: string;
  nativeName: string;
}

const LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文" },
  { code: "zh-TW", name: "Chinese (Traditional)", nativeName: "繁體中文" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "sv", name: "Swedish", nativeName: "Svenska" },
  { code: "no", name: "Norwegian", nativeName: "Norsk" },
  { code: "da", name: "Danish", nativeName: "Dansk" },
  { code: "fi", name: "Finnish", nativeName: "Suomi" },
  { code: "pl", name: "Polish", nativeName: "Polski" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "th", name: "Thai", nativeName: "ไทย" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu" },
];

interface LanguageSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (language: Language) => void;
  selectedLanguage?: string;
}

const LanguageSelectionModal = ({
  visible,
  onClose,
  onSelect,
  selectedLanguage = "en",
}: LanguageSelectionModalProps) => {
  console.log("[LanguageModal] Rendering - visible:", visible, "selectedLanguage:", selectedLanguage);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50">
        <Pressable
          className="flex-1"
          onPress={() => {
            console.log("[LanguageModal] Background pressed - closing");
            onClose();
          }}
        />
        <View className="bg-slate-900 rounded-t-3xl border-t border-slate-700" style={{ height: '80%' }}>
          {/* Header */}
          <View className="flex-row items-center justify-between p-6 border-b border-slate-800">
            <Text className="text-white text-2xl font-bold">Select Language</Text>
            <Pressable
              onPress={() => {
                console.log("[LanguageModal] Close button pressed");
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              className="bg-slate-800 p-2 rounded-lg"
            >
              <X size={20} color="#fff" />
            </Pressable>
          </View>

          {/* Language List */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
            showsVerticalScrollIndicator={true}
          >
            <View className="gap-2">
              {LANGUAGES.map((language) => (
                <Pressable
                  key={language.code}
                  onPress={() => {
                    console.log("[LanguageModal] Language pressed:", language.code);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelect(language);
                  }}
                  className={`p-4 rounded-xl flex-row items-center justify-between ${
                    selectedLanguage === language.code
                      ? "bg-blue-600"
                      : "bg-slate-800"
                  }`}
                >
                  <View>
                    <Text
                      className={`text-lg font-bold ${
                        selectedLanguage === language.code
                          ? "text-white"
                          : "text-slate-200"
                      }`}
                    >
                      {language.nativeName}
                    </Text>
                    <Text
                      className={`text-sm ${
                        selectedLanguage === language.code
                          ? "text-blue-100"
                          : "text-slate-400"
                      }`}
                    >
                      {language.name}
                    </Text>
                  </View>
                  {selectedLanguage === language.code && (
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

export { LanguageSelectionModal, LANGUAGES };
export type { Language };
