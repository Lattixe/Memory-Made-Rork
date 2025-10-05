import React, { useState, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Settings, Save, RotateCcw } from "lucide-react-native";
import { neutralColors as colors } from "@/constants/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ADMIN_SETTINGS_KEY = '@admin_settings';

export interface AdminSettings {
  placeholder?: boolean;
  initialGenerationPrompt?: string;
  regenerationPrompt?: string;
  editPrompt?: string;
}

const DEFAULT_INITIAL_GENERATION_PROMPT = 'Carefully analyze this photo and identify ALL prominent objects, people, animals, and distinctive elements. For each subject, create an accurate kiss-cut sticker design that closely matches the original appearance while optimizing for Printful printing. CRITICAL REQUIREMENTS: 1) COMPLETELY TRANSPARENT BACKGROUND - remove all background elements and make the background fully transparent (PNG format with alpha channel), 2) PRESERVE the exact colors, patterns, textures, and distinctive features of each subject from the original photo, 3) Maintain accurate proportions, poses, and spatial relationships between elements, 4) Keep recognizable details like facial features, clothing patterns, logos, text, or unique markings, 5) Use the actual color palette from the photo - do not change or stylize colors unless necessary for print quality, 6) Create clean vector-style edges with smooth curves around the subject, 7) CENTER the main subject PERFECTLY in the image frame with equal padding on all sides - the subject should be in the exact center both horizontally and vertically, 8) Add minimum 0.125 inch (3mm) bleed area around each design, 9) Avoid fine details smaller than 0.1 inch but preserve character-defining features, 10) Use bold, clear outlines while maintaining subject accuracy, 11) Ensure designs work at 3x3 inch minimum size, 12) Make the subject fill approximately 85-90% of the frame for optimal viewing and consistent sizing. The goal is photographic accuracy transformed into perfectly centered, transparent sticker format with the subject filling most of the frame.';

const DEFAULT_REGENERATION_PROMPT = 'Create a completely new high-quality kiss-cut sticker design based on this description: "{{USER_PROMPT}}". IGNORE the white background image provided - this is just a placeholder. Create an entirely new design from scratch. REQUIREMENTS: 1) COMPLETELY TRANSPARENT BACKGROUND - no background elements, fully transparent PNG with alpha channel, 2) Design should be optimized for Printful kiss-cut sticker printing, 3) Use vibrant, bold colors that will print well, 4) Create clean vector-style artwork with smooth edges, 5) CENTER the main subject PERFECTLY in the image frame with equal padding on all sides - the subject should be in the exact center both horizontally and vertically, 6) Add minimum 0.125 inch (3mm) bleed area around the design, 7) Avoid fine details smaller than 0.1 inch, 8) Use bold, clear outlines, 9) Ensure design works at 3x3 inch minimum size, 10) Make it visually appealing and memorable as a sticker, 11) Focus on the main subject with no background elements, 12) Make the subject fill approximately 85-90% of the frame for optimal viewing and consistent sizing. Generate a completely original design based on the text description with transparent background, perfectly centered and filling most of the frame.';

const DEFAULT_EDIT_PROMPT = '{{USER_PROMPT}} Keep the sticker style clean and suitable for die-cut printing.';

const DEFAULT_SETTINGS: AdminSettings = {
  placeholder: true,
  initialGenerationPrompt: DEFAULT_INITIAL_GENERATION_PROMPT,
  regenerationPrompt: DEFAULT_REGENERATION_PROMPT,
  editPrompt: DEFAULT_EDIT_PROMPT,
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
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [editingPrompt, setEditingPrompt] = useState<{
    type: 'initial' | 'regeneration' | 'edit';
    value: string;
  } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const loaded = await getAdminSettings();
    setSettings(loaded);
  };

  const handleSavePrompt = async (type: 'initial' | 'regeneration' | 'edit', value: string) => {
    setIsSaving(true);
    try {
      const updatedSettings = { ...settings };
      if (type === 'initial') {
        updatedSettings.initialGenerationPrompt = value;
      } else if (type === 'regeneration') {
        updatedSettings.regenerationPrompt = value;
      } else if (type === 'edit') {
        updatedSettings.editPrompt = value;
      }
      await saveAdminSettings(updatedSettings);
      setSettings(updatedSettings);
      setEditingPrompt(null);
      Alert.alert('Success', 'Prompt saved successfully!');
    } catch (error) {
      console.error('Error saving prompt:', error);
      Alert.alert('Error', 'Failed to save prompt. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPrompt = (type: 'initial' | 'regeneration' | 'edit') => {
    Alert.alert(
      'Reset Prompt',
      'Are you sure you want to reset this prompt to the default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const defaultValue = type === 'initial' 
              ? DEFAULT_INITIAL_GENERATION_PROMPT 
              : type === 'regeneration' 
              ? DEFAULT_REGENERATION_PROMPT 
              : DEFAULT_EDIT_PROMPT;
            await handleSavePrompt(type, defaultValue);
          },
        },
      ]
    );
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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Prompts</Text>
            <Text style={styles.helpText}>
              Customize the prompts used for sticker generation, regeneration, and editing.
            </Text>

            {/* Initial Generation Prompt */}
            <View style={styles.promptSection}>
              <View style={styles.promptHeader}>
                <Text style={styles.promptLabel}>Initial Generation Prompt</Text>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => handleResetPrompt('initial')}
                >
                  <RotateCcw size={14} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.promptDescription}>
                Used when generating stickers from uploaded photos.
              </Text>
              {editingPrompt?.type === 'initial' ? (
                <View>
                  <TextInput
                    style={styles.promptInput}
                    value={editingPrompt.value}
                    onChangeText={(text) => setEditingPrompt({ type: 'initial', value: text })}
                    multiline
                    numberOfLines={8}
                    textAlignVertical="top"
                  />
                  <View style={styles.promptActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setEditingPrompt(null)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={() => handleSavePrompt('initial', editingPrompt.value)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <>
                          <Save size={16} color={colors.white} />
                          <Text style={styles.saveButtonText}>Save</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={styles.promptPreview} numberOfLines={3}>
                    {settings.initialGenerationPrompt || DEFAULT_INITIAL_GENERATION_PROMPT}
                  </Text>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => setEditingPrompt({ 
                      type: 'initial', 
                      value: settings.initialGenerationPrompt || DEFAULT_INITIAL_GENERATION_PROMPT 
                    })}
                  >
                    <Text style={styles.editButtonText}>Edit Prompt</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Regeneration Prompt */}
            <View style={styles.promptSection}>
              <View style={styles.promptHeader}>
                <Text style={styles.promptLabel}>Regeneration Prompt</Text>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => handleResetPrompt('regeneration')}
                >
                  <RotateCcw size={14} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.promptDescription}>
                Used when regenerating stickers with custom text prompts. Use {'{{'} USER_PROMPT {'}}'}  as a placeholder for the user&apos;s input.
              </Text>
              {editingPrompt?.type === 'regeneration' ? (
                <View>
                  <TextInput
                    style={styles.promptInput}
                    value={editingPrompt.value}
                    onChangeText={(text) => setEditingPrompt({ type: 'regeneration', value: text })}
                    multiline
                    numberOfLines={8}
                    textAlignVertical="top"
                  />
                  <View style={styles.promptActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setEditingPrompt(null)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={() => handleSavePrompt('regeneration', editingPrompt.value)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <>
                          <Save size={16} color={colors.white} />
                          <Text style={styles.saveButtonText}>Save</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={styles.promptPreview} numberOfLines={3}>
                    {settings.regenerationPrompt || DEFAULT_REGENERATION_PROMPT}
                  </Text>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => setEditingPrompt({ 
                      type: 'regeneration', 
                      value: settings.regenerationPrompt || DEFAULT_REGENERATION_PROMPT 
                    })}
                  >
                    <Text style={styles.editButtonText}>Edit Prompt</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Edit Prompt */}
            <View style={styles.promptSection}>
              <View style={styles.promptHeader}>
                <Text style={styles.promptLabel}>Edit Prompt Suffix</Text>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => handleResetPrompt('edit')}
                >
                  <RotateCcw size={14} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.promptDescription}>
                Appended to user&apos;s edit requests. Use {'{{'} USER_PROMPT {'}}'}  as a placeholder for the user&apos;s input.
              </Text>
              {editingPrompt?.type === 'edit' ? (
                <View>
                  <TextInput
                    style={styles.promptInput}
                    value={editingPrompt.value}
                    onChangeText={(text) => setEditingPrompt({ type: 'edit', value: text })}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  <View style={styles.promptActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setEditingPrompt(null)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={() => handleSavePrompt('edit', editingPrompt.value)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <>
                          <Save size={16} color={colors.white} />
                          <Text style={styles.saveButtonText}>Save</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={styles.promptPreview} numberOfLines={2}>
                    {settings.editPrompt || DEFAULT_EDIT_PROMPT}
                  </Text>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => setEditingPrompt({ 
                      type: 'edit', 
                      value: settings.editPrompt || DEFAULT_EDIT_PROMPT 
                    })}
                  >
                    <Text style={styles.editButtonText}>Edit Prompt</Text>
                  </TouchableOpacity>
                </View>
              )}
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
  promptSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  promptLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  promptDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  promptPreview: {
    fontSize: 13,
    color: colors.text.primary,
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    lineHeight: 18,
    marginBottom: 8,
  },
  promptInput: {
    fontSize: 13,
    color: colors.text.primary,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    maxHeight: 300,
    lineHeight: 18,
    marginBottom: 12,
  },
  promptActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  editButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  editButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  cancelButton: {
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  saveButton: {
    backgroundColor: colors.success,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  resetButton: {
    padding: 4,
  },
});