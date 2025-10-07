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
import { Settings, Save, RotateCcw, Sliders } from "lucide-react-native";
import { neutralColors as colors } from "@/constants/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StickerSettingsPanel, DEFAULT_SETTINGS as DEFAULT_STICKER_SETTINGS, StickerProcessingSettings } from "@/components/StickerSettingsPanel";

const ADMIN_SETTINGS_KEY = '@admin_settings';
const STICKER_SETTINGS_KEY = '@sticker_processing_settings';

export type EditModel = 'nano-banana' | 'seedream';

export interface AdminSettings {
  placeholder?: boolean;
  initialGenerationPrompt?: string;
  regenerationPrompt?: string;
  editPrompt?: string;
  editModel?: EditModel;
}

const DEFAULT_INITIAL_GENERATION_PROMPT = 'Carefully analyze this photo and identify ALL prominent objects, people, animals, and distinctive elements. For each subject, create an accurate kiss-cut sticker design that closely matches the original appearance while optimizing for Printful printing. CRITICAL REQUIREMENTS: 1) COMPLETELY TRANSPARENT BACKGROUND - remove all background elements and make the background fully transparent (PNG format with alpha channel), 2) PRESERVE the exact colors, patterns, textures, and distinctive features of each subject from the original photo, 3) Maintain accurate proportions, poses, and spatial relationships between elements, 4) Keep recognizable details like facial features, clothing patterns, logos, text, or unique markings, 5) Use the actual color palette from the photo - do not change or stylize colors unless necessary for print quality, 6) Create clean vector-style edges with smooth curves around the subject, 7) CENTER the main subject PERFECTLY in the image frame with equal padding on all sides - the subject should be in the exact center both horizontally and vertically, 8) Add minimum 0.125 inch (3mm) bleed area around each design, 9) Avoid fine details smaller than 0.1 inch but preserve character-defining features, 10) Use bold, clear outlines while maintaining subject accuracy, 11) Ensure designs work at 3x3 inch minimum size, 12) Make the subject fill approximately 85-90% of the frame for optimal viewing and consistent sizing. The goal is photographic accuracy transformed into perfectly centered, transparent sticker format with the subject filling most of the frame.';

const DEFAULT_REGENERATION_PROMPT = 'Create a completely new high-quality kiss-cut sticker design based on this description: "{{USER_PROMPT}}". IGNORE the white background image provided - this is just a placeholder. Create an entirely new design from scratch. REQUIREMENTS: 1) COMPLETELY TRANSPARENT BACKGROUND - no background elements, fully transparent PNG with alpha channel, 2) Design should be optimized for Printful kiss-cut sticker printing, 3) Use vibrant, bold colors that will print well, 4) Create clean vector-style artwork with smooth edges, 5) CENTER the main subject PERFECTLY in the image frame with equal padding on all sides - the subject should be in the exact center both horizontally and vertically, 6) Add minimum 0.125 inch (3mm) bleed area around the design, 7) Avoid fine details smaller than 0.1 inch, 8) Use bold, clear outlines, 9) Ensure design works at 3x3 inch minimum size, 10) Make it visually appealing and memorable as a sticker, 11) Focus on the main subject with no background elements, 12) Make the subject fill approximately 85-90% of the frame for optimal viewing and consistent sizing. Generate a completely original design based on the text description with transparent background, perfectly centered and filling most of the frame.';

const DEFAULT_EDIT_PROMPT = '{{USER_PROMPT}} Keep the sticker style clean and suitable for die-cut printing.';

const DEFAULT_SETTINGS: AdminSettings = {
  placeholder: true,
  initialGenerationPrompt: DEFAULT_INITIAL_GENERATION_PROMPT,
  regenerationPrompt: DEFAULT_REGENERATION_PROMPT,
  editPrompt: DEFAULT_EDIT_PROMPT,
  editModel: 'nano-banana',
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
  const [selectedModel, setSelectedModel] = useState<EditModel>('nano-banana');
  const [showStickerSettings, setShowStickerSettings] = useState<boolean>(false);
  const [stickerSettings, setStickerSettings] = useState<StickerProcessingSettings>(DEFAULT_STICKER_SETTINGS);

  useEffect(() => {
    loadSettings();
    loadStickerSettings();
  }, []);

  const loadSettings = async () => {
    const loaded = await getAdminSettings();
    setSettings(loaded);
    setSelectedModel(loaded.editModel || 'nano-banana');
  };

  const loadStickerSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STICKER_SETTINGS_KEY);
      if (stored) {
        setStickerSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading sticker settings:', error);
    }
  };

  const saveStickerSettings = async (newSettings: StickerProcessingSettings) => {
    try {
      await AsyncStorage.setItem(STICKER_SETTINGS_KEY, JSON.stringify(newSettings));
      setStickerSettings(newSettings);
    } catch (error) {
      console.error('Error saving sticker settings:', error);
      Alert.alert('Error', 'Failed to save sticker settings');
    }
  };

  const resetStickerSettings = async () => {
    try {
      await AsyncStorage.setItem(STICKER_SETTINGS_KEY, JSON.stringify(DEFAULT_STICKER_SETTINGS));
      setStickerSettings(DEFAULT_STICKER_SETTINGS);
      Alert.alert('Success', 'Sticker settings reset to defaults');
    } catch (error) {
      console.error('Error resetting sticker settings:', error);
      Alert.alert('Error', 'Failed to reset sticker settings');
    }
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
            <Text style={styles.sectionTitle}>Sticker Processing Settings</Text>
            <Text style={styles.helpText}>
              Configure background removal, edge processing, compression, and other sticker generation parameters.
            </Text>

            <TouchableOpacity
              style={styles.openSettingsButton}
              onPress={() => setShowStickerSettings(true)}
            >
              <Sliders size={18} color={colors.white} />
              <Text style={styles.openSettingsButtonText}>Open Processing Settings</Text>
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Current: {stickerSettings.skipBackgroundRemoval ? '❌' : '✓'} Background Removal
              </Text>
              <Text style={styles.infoText}>
                Current: {stickerSettings.enableAutoCrop ? '✓' : '❌'} Auto-crop
              </Text>
              <Text style={styles.infoText}>
                Current: {stickerSettings.addStroke ? '✓' : '❌'} Add Stroke
              </Text>
              <Text style={styles.infoText}>
                Current: Alpha Threshold {stickerSettings.alphaThreshold}, Fringe Erode {stickerSettings.fringeErode}
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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Edit Model Selection</Text>
            <Text style={styles.helpText}>
              Choose which AI model to use for sticker editing.
            </Text>

            <View style={styles.modelSelectionContainer}>
              <TouchableOpacity
                style={[
                  styles.modelOption,
                  selectedModel === 'nano-banana' && styles.modelOptionSelected,
                ]}
                onPress={async () => {
                  setSelectedModel('nano-banana');
                  const updatedSettings = { ...settings, editModel: 'nano-banana' as EditModel };
                  await saveAdminSettings(updatedSettings);
                  setSettings(updatedSettings);
                  Alert.alert('Success', 'Model updated to Nano Banana');
                }}
              >
                <View style={styles.modelOptionContent}>
                  <Text style={styles.modelOptionTitle}>Nano Banana</Text>
                  <Text style={styles.modelOptionDescription}>
                    Google Gemini 2.5 Flash - Fast and reliable image editing
                  </Text>
                </View>
                {selectedModel === 'nano-banana' && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modelOption,
                  selectedModel === 'seedream' && styles.modelOptionSelected,
                ]}
                onPress={async () => {
                  setSelectedModel('seedream');
                  const updatedSettings = { ...settings, editModel: 'seedream' as EditModel };
                  await saveAdminSettings(updatedSettings);
                  setSettings(updatedSettings);
                  Alert.alert('Success', 'Model updated to SeeDream');
                }}
              >
                <View style={styles.modelOptionContent}>
                  <Text style={styles.modelOptionTitle}>SeeDream v4</Text>
                  <Text style={styles.modelOptionDescription}>
                    ByteDance SeeDream - Advanced image editing with high quality output
                  </Text>
                </View>
                {selectedModel === 'seedream' && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <StickerSettingsPanel
        visible={showStickerSettings}
        onClose={() => setShowStickerSettings(false)}
        settings={stickerSettings}
        onSettingsChange={saveStickerSettings}
        onResetToDefaults={resetStickerSettings}
      />
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
  modelSelectionContainer: {
    marginTop: 16,
    gap: 12,
  },
  modelOption: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modelOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  modelOptionContent: {
    flex: 1,
  },
  modelOptionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  modelOptionDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  selectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold' as const,
  },
  openSettingsButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  openSettingsButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600' as const,
  },
});