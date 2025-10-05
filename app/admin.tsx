import React, { useState, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Settings, Save } from "lucide-react-native";
import { neutralColors as colors } from "@/constants/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ADMIN_SETTINGS_KEY = '@admin_settings';

export interface AdminSettings {
  enablePostProcessing: boolean;
  alphaThreshold: number;
  fringeErode: number;
  despeckleSize: number;
}

const DEFAULT_SETTINGS: AdminSettings = {
  enablePostProcessing: true,
  alphaThreshold: 5,
  fringeErode: 2,
  despeckleSize: 3,
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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const loaded = await getAdminSettings();
    setSettings(loaded);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await saveAdminSettings(settings);
      if (Platform.OS === 'web') {
        alert('Settings saved successfully!');
      } else {
        Alert.alert('Success', 'Settings saved successfully!');
      }
    } catch (error) {
      if (Platform.OS === 'web') {
        alert('Failed to save settings');
      } else {
        Alert.alert('Error', 'Failed to save settings');
      }
    } finally {
      setIsSaving(false);
    }
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
            <Text style={styles.sectionTitle}>Background Removal Post-Processing</Text>
            <Text style={styles.helpText}>
              Control the post-processing applied after 851-labs background removal to clean up artifacts and white fringes.
            </Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Enable Post-Processing</Text>
                <Text style={styles.settingDescription}>
                  Apply defringe and despeckle after background removal
                </Text>
              </View>
              <Switch
                value={settings.enablePostProcessing}
                onValueChange={(value) => setSettings({ ...settings, enablePostProcessing: value })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            {settings.enablePostProcessing && (
              <>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Alpha Threshold</Text>
                    <Text style={styles.settingDescription}>
                      Pixels with alpha below this value become fully transparent (0-255)
                    </Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={settings.alphaThreshold.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text) || 0;
                      setSettings({ ...settings, alphaThreshold: Math.max(0, Math.min(255, num)) });
                    }}
                    keyboardType="number-pad"
                    placeholder="5"
                  />
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Fringe Erode</Text>
                    <Text style={styles.settingDescription}>
                      Number of erosion passes to remove white fringes (0-5)
                    </Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={settings.fringeErode.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text) || 0;
                      setSettings({ ...settings, fringeErode: Math.max(0, Math.min(5, num)) });
                    }}
                    keyboardType="number-pad"
                    placeholder="2"
                  />
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Despeckle Size</Text>
                    <Text style={styles.settingDescription}>
                      Remove isolated pixels with fewer neighbors (0-9)
                    </Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={settings.despeckleSize.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text) || 0;
                      setSettings({ ...settings, despeckleSize: Math.max(0, Math.min(9, num)) });
                    }}
                    keyboardType="number-pad"
                    placeholder="3"
                  />
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              <Save size={20} color="#fff" />
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Text>
            </TouchableOpacity>
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
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  input: {
    width: 80,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: "#fff",
    textAlign: "center" as const,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 20,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#fff",
  },
});