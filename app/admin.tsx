import React, { useState, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Settings } from "lucide-react-native";
import { neutralColors as colors } from "@/constants/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ADMIN_SETTINGS_KEY = '@admin_settings';

export interface AdminSettings {
  placeholder?: boolean;
}

const DEFAULT_SETTINGS: AdminSettings = {
  placeholder: true,
};

export async function getAdminSettings(): Promise<AdminSettings> {
  try {
    const stored = await AsyncStorage.getItem(ADMIN_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error loading admin settings:', error);
  }
  return DEFAULT_SETTINGS;
}

export async function saveAdminSettings(settings: AdminSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving admin settings:', error);
    throw error;
  }
}

export default function AdminSettings() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const loaded = await getAdminSettings();
    setSettings(loaded);
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Settings size={24} color={colors.primary} />
            <Text style={styles.title}>Admin Settings</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Background Removal</Text>
            <Text style={styles.helpText}>
              Background removal is handled by 851-labs API. The output is used directly without additional post-processing.
            </Text>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ✓ 851-labs background removal enabled
              </Text>
              <Text style={styles.infoText}>
                ✓ Auto-crop enabled
              </Text>
              <Text style={styles.infoText}>
                ✓ No post-processing applied
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold" as const,
    color: colors.text.primary,
    marginLeft: 10,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: colors.text.primary,
    marginLeft: 8,
    flex: 1,
  },

  helpText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 12,
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  infoText: {
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 8,
    lineHeight: 20,
  },
});