import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Modal,
} from 'react-native';
import { Settings, X } from 'lucide-react-native';
import { neutralColors } from '@/constants/colors';

export type StickerProcessingSettings = {
  skipBackgroundRemoval: boolean;
  isAIGenerated: boolean;
  addStroke: boolean;
  strokeWidth: number;
  strokeColor: string;
  alphaThreshold: number;
  fringeErode: number;
  despeckleSize: number;
  enableGentleCleanup: boolean;
  enableAutoCrop: boolean;
  compressionQuality: number;
  compressionMaxSize: number;
  apiTimeout: number;
  apiRetries: number;
};

export const DEFAULT_SETTINGS: StickerProcessingSettings = {
  skipBackgroundRemoval: true,
  isAIGenerated: true,
  addStroke: false,
  strokeWidth: 3,
  strokeColor: '#FFFFFF',
  alphaThreshold: 5,
  fringeErode: 2,
  despeckleSize: 3,
  enableGentleCleanup: false,
  enableAutoCrop: false,
  compressionQuality: 0.6,
  compressionMaxSize: 512,
  apiTimeout: 4000,
  apiRetries: 1,
};

type Props = {
  visible: boolean;
  onClose: () => void;
  settings: StickerProcessingSettings;
  onSettingsChange: (settings: StickerProcessingSettings) => void;
  onResetToDefaults: () => void;
};

export const StickerSettingsPanel: React.FC<Props> = ({
  visible,
  onClose,
  settings,
  onSettingsChange,
  onResetToDefaults,
}) => {
  const updateSetting = <K extends keyof StickerProcessingSettings>(
    key: K,
    value: StickerProcessingSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Settings size={20} color={neutralColors.primary} />
              <Text style={styles.headerTitle}>Sticker Processing Settings</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color={neutralColors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Background Removal</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Skip Background Removal</Text>
                  <Text style={styles.settingDescription}>
                    Use when image already has transparent background
                  </Text>
                </View>
                <Switch
                  value={settings.skipBackgroundRemoval}
                  onValueChange={(value) => updateSetting('skipBackgroundRemoval', value)}
                  trackColor={{ false: neutralColors.border, true: neutralColors.primary }}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>AI Generated Image</Text>
                  <Text style={styles.settingDescription}>
                    Use gentler processing for AI-generated images
                  </Text>
                </View>
                <Switch
                  value={settings.isAIGenerated}
                  onValueChange={(value) => updateSetting('isAIGenerated', value)}
                  trackColor={{ false: neutralColors.border, true: neutralColors.primary }}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Stroke/Outline</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Add Stroke</Text>
                  <Text style={styles.settingDescription}>
                    Add white outline around sticker (not recommended for Printful)
                  </Text>
                </View>
                <Switch
                  value={settings.addStroke}
                  onValueChange={(value) => updateSetting('addStroke', value)}
                  trackColor={{ false: neutralColors.border, true: neutralColors.primary }}
                />
              </View>

              {settings.addStroke && (
                <>
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Stroke Width</Text>
                      <Text style={styles.settingDescription}>
                        Width in pixels (1-10)
                      </Text>
                    </View>
                    <TextInput
                      style={styles.numberInput}
                      value={settings.strokeWidth.toString()}
                      onChangeText={(text) => {
                        const num = parseInt(text) || 3;
                        updateSetting('strokeWidth', Math.max(1, Math.min(10, num)));
                      }}
                      keyboardType="number-pad"
                    />
                  </View>

                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Stroke Color</Text>
                      <Text style={styles.settingDescription}>
                        Hex color code
                      </Text>
                    </View>
                    <TextInput
                      style={styles.textInput}
                      value={settings.strokeColor}
                      onChangeText={(text) => updateSetting('strokeColor', text)}
                      placeholder="#FFFFFF"
                      autoCapitalize="characters"
                    />
                  </View>
                </>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Edge Processing</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Alpha Threshold</Text>
                  <Text style={styles.settingDescription}>
                    Remove pixels below this alpha value (0-255)
                  </Text>
                </View>
                <TextInput
                  style={styles.numberInput}
                  value={settings.alphaThreshold.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 5;
                    updateSetting('alphaThreshold', Math.max(0, Math.min(255, num)));
                  }}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Fringe Erode</Text>
                  <Text style={styles.settingDescription}>
                    Remove edge fringing (0-5 iterations)
                  </Text>
                </View>
                <TextInput
                  style={styles.numberInput}
                  value={settings.fringeErode.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 2;
                    updateSetting('fringeErode', Math.max(0, Math.min(5, num)));
                  }}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Despeckle Size</Text>
                  <Text style={styles.settingDescription}>
                    Remove small isolated pixels (0-9 neighbors)
                  </Text>
                </View>
                <TextInput
                  style={styles.numberInput}
                  value={settings.despeckleSize.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 3;
                    updateSetting('despeckleSize', Math.max(0, Math.min(9, num)));
                  }}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Gentle Edge Cleanup</Text>
                  <Text style={styles.settingDescription}>
                    Remove very faint edge artifacts
                  </Text>
                </View>
                <Switch
                  value={settings.enableGentleCleanup}
                  onValueChange={(value) => updateSetting('enableGentleCleanup', value)}
                  trackColor={{ false: neutralColors.border, true: neutralColors.primary }}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Image Processing</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Auto Crop</Text>
                  <Text style={styles.settingDescription}>
                    Automatically crop to content bounds
                  </Text>
                </View>
                <Switch
                  value={settings.enableAutoCrop}
                  onValueChange={(value) => updateSetting('enableAutoCrop', value)}
                  trackColor={{ false: neutralColors.border, true: neutralColors.primary }}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Compression Quality</Text>
                  <Text style={styles.settingDescription}>
                    JPEG quality for API upload (0.1-1.0)
                  </Text>
                </View>
                <TextInput
                  style={styles.numberInput}
                  value={settings.compressionQuality.toFixed(1)}
                  onChangeText={(text) => {
                    const num = parseFloat(text) || 0.6;
                    updateSetting('compressionQuality', Math.max(0.1, Math.min(1.0, num)));
                  }}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Max Image Size</Text>
                  <Text style={styles.settingDescription}>
                    Maximum dimension in pixels (256-2048)
                  </Text>
                </View>
                <TextInput
                  style={styles.numberInput}
                  value={settings.compressionMaxSize.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 512;
                    updateSetting('compressionMaxSize', Math.max(256, Math.min(2048, num)));
                  }}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>API Settings</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>API Timeout</Text>
                  <Text style={styles.settingDescription}>
                    Request timeout in milliseconds (1000-30000)
                  </Text>
                </View>
                <TextInput
                  style={styles.numberInput}
                  value={settings.apiTimeout.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 4000;
                    updateSetting('apiTimeout', Math.max(1000, Math.min(30000, num)));
                  }}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>API Retries</Text>
                  <Text style={styles.settingDescription}>
                    Number of retry attempts (0-5)
                  </Text>
                </View>
                <TextInput
                  style={styles.numberInput}
                  value={settings.apiRetries.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 1;
                    updateSetting('apiRetries', Math.max(0, Math.min(5, num)));
                  }}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.resetButton}
              onPress={onResetToDefaults}
            >
              <Text style={styles.resetButtonText}>Reset to Defaults</Text>
            </TouchableOpacity>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: neutralColors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: neutralColors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: neutralColors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: neutralColors.text.primary,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: neutralColors.text.secondary,
    lineHeight: 18,
  },
  numberInput: {
    width: 70,
    height: 36,
    borderWidth: 1,
    borderColor: neutralColors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 14,
    color: neutralColors.text.primary,
    textAlign: 'center',
    backgroundColor: neutralColors.surface,
  },
  textInput: {
    width: 100,
    height: 36,
    borderWidth: 1,
    borderColor: neutralColors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 14,
    color: neutralColors.text.primary,
    backgroundColor: neutralColors.surface,
  },
  resetButton: {
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 14,
    backgroundColor: neutralColors.error,
    borderRadius: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: neutralColors.white,
  },
  bottomSpacer: {
    height: 20,
  },
});
