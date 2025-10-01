import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Grid3X3, Check } from 'lucide-react-native';
import { neutralColors } from '@/constants/colors';
import { router, useLocalSearchParams } from 'expo-router';

type SheetSize = '3x3' | '4x4' | '5.5x5.5';

type SheetConfig = {
  size: SheetSize;
  displayName: string;
  inches: [number, number];
  cellsPerSide: number;
  totalMinis: number;
  price: number;
  description: string;
};

const SHEET_CONFIGS: SheetConfig[] = [
  {
    size: '3x3',
    displayName: '3" × 3"',
    inches: [3.0, 3.0],
    cellsPerSide: 9,
    totalMinis: 81,
    price: 12.99,
    description: 'Perfect for small collections',
  },
  {
    size: '4x4',
    displayName: '4" × 4"',
    inches: [4.0, 4.0],
    cellsPerSide: 12,
    totalMinis: 144,
    price: 16.99,
    description: 'Most popular size',
  },
  {
    size: '5.5x5.5',
    displayName: '5.5" × 5.5"',
    inches: [5.5, 5.5],
    cellsPerSide: 17,
    totalMinis: 289,
    price: 24.99,
    description: 'Maximum stickers per sheet',
  },
];

export default function SheetSizeSelectionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const stickerImage = typeof params.stickerImage === 'string' ? params.stickerImage : '';
  const originalImage = typeof params.originalImage === 'string' ? params.originalImage : '';
  
  const [selectedSize, setSelectedSize] = useState<SheetSize>('4x4');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const handleGenerateSheet = async () => {
    if (!stickerImage) {
      Alert.alert('Error', 'No sticker image found');
      return;
    }

    setIsGenerating(true);

    try {
      const selectedConfig = SHEET_CONFIGS.find(c => c.size === selectedSize);
      if (!selectedConfig) {
        throw new Error('Invalid sheet size selected');
      }

      // Navigate to checkout with sheet generation params
      router.push({
        pathname: '/checkout',
        params: {
          originalImage,
          finalStickers: stickerImage,
          sheetSize: selectedSize,
          sheetConfig: JSON.stringify(selectedConfig),
          isMultiStickerSheet: 'true',
        },
      });
    } catch (error) {
      console.error('Error preparing sheet:', error);
      Alert.alert('Error', 'Failed to prepare sticker sheet. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
            disabled={isGenerating}
          >
            <ArrowLeft size={20} color={neutralColors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Choose Sheet Size</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.introSection}>
              <Grid3X3 size={32} color={neutralColors.primary} />
              <Text style={styles.introTitle}>Dense Mini Sticker Sheets</Text>
              <Text style={styles.introDescription}>
                Each sheet is filled with 0.25&quot; × 0.25&quot; mini stickers of your design, 
                perfect for planners, journals, and crafts.
              </Text>
            </View>

            <View style={styles.optionsContainer}>
              {SHEET_CONFIGS.map((config) => (
                <TouchableOpacity
                  key={config.size}
                  style={[
                    styles.sizeOption,
                    selectedSize === config.size && styles.sizeOptionSelected,
                  ]}
                  onPress={() => setSelectedSize(config.size)}
                  disabled={isGenerating}
                  activeOpacity={0.7}
                >
                  <View style={styles.sizeOptionHeader}>
                    <View style={styles.sizeInfo}>
                      <Text style={[
                        styles.sizeName,
                        selectedSize === config.size && styles.sizeNameSelected,
                      ]}>
                        {config.displayName}
                      </Text>
                      <Text style={styles.sizeDescription}>{config.description}</Text>
                    </View>
                    {selectedSize === config.size && (
                      <View style={styles.checkmark}>
                        <Check size={20} color={neutralColors.white} />
                      </View>
                    )}
                  </View>

                  <View style={styles.sizeDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Mini Stickers:</Text>
                      <Text style={styles.detailValue}>{config.totalMinis} stickers</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Grid Layout:</Text>
                      <Text style={styles.detailValue}>{config.cellsPerSide} × {config.cellsPerSide}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Each Sticker:</Text>
                      <Text style={styles.detailValue}>0.25&quot; × 0.25&quot;</Text>
                    </View>
                  </View>

                  <View style={styles.priceContainer}>
                    <Text style={[
                      styles.price,
                      selectedSize === config.size && styles.priceSelected,
                    ]}>
                      ${config.price.toFixed(2)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.featuresSection}>
              <Text style={styles.featuresTitle}>What You Get:</Text>
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <Text style={styles.featureBullet}>•</Text>
                  <Text style={styles.featureText}>
                    Professional kiss-cut stickers with white border
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureBullet}>•</Text>
                  <Text style={styles.featureText}>
                    High-quality 300 DPI print resolution
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureBullet}>•</Text>
                  <Text style={styles.featureText}>
                    Safe margins and proper bleed for clean cuts
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureBullet}>•</Text>
                  <Text style={styles.featureText}>
                    Each mini sticker peels independently
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
            onPress={handleGenerateSheet}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator size="small" color={neutralColors.white} />
                <Text style={styles.generateButtonText}>Preparing...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <Grid3X3 size={20} color={neutralColors.white} />
                <Text style={styles.generateButtonText}>
                  Generate {SHEET_CONFIGS.find(c => c.size === selectedSize)?.displayName} Sheet
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: neutralColors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: neutralColors.border,
    backgroundColor: neutralColors.white,
  },
  backButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: neutralColors.surface,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
  },
  headerSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  introSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 20,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: neutralColors.text.primary,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  introDescription: {
    fontSize: 15,
    color: neutralColors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  optionsContainer: {
    gap: 16,
    marginBottom: 32,
  },
  sizeOption: {
    backgroundColor: neutralColors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: neutralColors.border,
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sizeOptionSelected: {
    borderColor: neutralColors.primary,
    backgroundColor: neutralColors.primary + '08',
  },
  sizeOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sizeInfo: {
    flex: 1,
  },
  sizeName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: neutralColors.text.primary,
    marginBottom: 4,
  },
  sizeNameSelected: {
    color: neutralColors.primary,
  },
  sizeDescription: {
    fontSize: 13,
    color: neutralColors.text.secondary,
  },
  checkmark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: neutralColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sizeDetails: {
    gap: 8,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: neutralColors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: neutralColors.text.secondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
  },
  priceContainer: {
    alignItems: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: neutralColors.border,
  },
  price: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: neutralColors.text.primary,
  },
  priceSelected: {
    color: neutralColors.primary,
  },
  featuresSection: {
    backgroundColor: neutralColors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: neutralColors.border,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
    marginBottom: 12,
  },
  featuresList: {
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  featureBullet: {
    fontSize: 16,
    color: neutralColors.primary,
    fontWeight: '700' as const,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: neutralColors.text.secondary,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: neutralColors.white,
    borderTopWidth: 1,
    borderTopColor: neutralColors.border,
    padding: 20,
  },
  generateButton: {
    backgroundColor: neutralColors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    shadowColor: neutralColors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateButtonText: {
    color: neutralColors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
