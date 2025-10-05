import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Grid3X3, Check, Layers } from 'lucide-react-native';
import { neutralColors } from '@/constants/colors';
import { STICKER_SHEET_LAYOUTS, SHEET_CONSTANTS, SheetSize as LayoutSheetSize } from '@/constants/stickerSheetLayouts';
import {
  getStickerDimensions,
  calculateDynamicLayouts,
  generateDynamicStickerSheet,
  DynamicSheetLayout,
  DynamicLayoutOption,
} from '@/utils/dynamicStickerLayout';
import { router, useLocalSearchParams } from 'expo-router';

type SheetSize = '3x3' | '4x4' | '5.5x5.5';

type SheetConfig = {
  size: SheetSize;
  displayName: string;
  inches: number;
  price: number;
  description: string;
};

const SHEET_CONFIGS: SheetConfig[] = [
  {
    size: '3x3',
    displayName: '3" × 3"',
    inches: 3.0,
    price: 12.99,
    description: 'Perfect for small collections',
  },
  {
    size: '4x4',
    displayName: '4" × 4"',
    inches: 4.0,
    price: 16.99,
    description: 'Most popular size',
  },
  {
    size: '5.5x5.5',
    displayName: '5.5" × 5.5"',
    inches: 5.5,
    price: 27.99,
    description: 'Maximum stickers per sheet',
  },
];

export default function SheetSizeSelectionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const stickerImage = typeof params.stickerImage === 'string' ? params.stickerImage : '';
  const originalImage = typeof params.originalImage === 'string' ? params.originalImage : '';

  useEffect(() => {
    async function analyzeStickerDimensions() {
      if (!stickerImage) return;
      
      try {
        console.log('[Dynamic Layout] Analyzing sticker dimensions...');
        const dimensions = await getStickerDimensions(stickerImage);
        console.log('[Dynamic Layout] Sticker dimensions:', dimensions);
        
        const layouts: Record<SheetSize, DynamicSheetLayout | null> = {
          '3x3': calculateDynamicLayouts('3x3', dimensions),
          '4x4': calculateDynamicLayouts('4x4', dimensions),
          '5.5x5.5': calculateDynamicLayouts('5.5x5.5', dimensions),
        };
        
        console.log('[Dynamic Layout] Generated layouts:', layouts);
        setDynamicLayouts(layouts);
      } catch (error) {
        console.error('[Dynamic Layout] Error analyzing sticker:', error);
      } finally {
        setIsAnalyzing(false);
      }
    }
    
    analyzeStickerDimensions();
  }, [stickerImage]);
  
  const [selectedSize, setSelectedSize] = useState<SheetSize>('4x4');
  const [selectedStickerCount, setSelectedStickerCount] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [dynamicLayouts, setDynamicLayouts] = useState<Record<SheetSize, DynamicSheetLayout | null>>({
    '3x3': null,
    '4x4': null,
    '5.5x5.5': null,
  });
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(true);

  const currentDynamicLayout = dynamicLayouts[selectedSize];
  const currentLayout = STICKER_SHEET_LAYOUTS[selectedSize as LayoutSheetSize];
  const currentStickerCount = selectedStickerCount ?? (currentDynamicLayout?.recommendedOption.count || currentLayout.defaultOption.count);

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

      let sheetImageBase64: string;
      
      if (currentDynamicLayout) {
        const dynamicOption = currentDynamicLayout.options.find(opt => opt.count === currentStickerCount);
        if (!dynamicOption) {
          throw new Error('Invalid sticker count selected');
        }

        console.log('[Sheet Generation] Creating dynamic sheet with:', {
          size: selectedSize,
          count: currentStickerCount,
          grid: dynamicOption.grid,
          dimensions: `${dynamicOption.stickerWidthInches.toFixed(2)}"×${dynamicOption.stickerHeightInches.toFixed(2)}"`,
        });

        sheetImageBase64 = await generateDynamicStickerSheet(
          stickerImage,
          selectedSize,
          dynamicOption
        );
      } else {
        const stickerOption = currentLayout.options.find(opt => opt.count === currentStickerCount);
        if (!stickerOption) {
          throw new Error('Invalid sticker count selected');
        }

        console.log('[Sheet Generation] Creating sheet with:', {
          size: selectedSize,
          count: currentStickerCount,
          grid: stickerOption.grid,
        });

        sheetImageBase64 = await generateRepeatedStickerSheet(
          stickerImage,
          selectedSize,
          currentStickerCount,
          stickerOption.grid
        );
      }

      console.log('[Sheet Generation] Sheet generated, navigating to checkout');

      router.push({
        pathname: '/checkout',
        params: {
          originalImage: originalImage || stickerImage,
          finalStickers: sheetImageBase64,
          isReorder: 'false',
          isStickerSheet: 'true',
          stickerCount: currentStickerCount.toString(),
          sheetSize: selectedSize,
          isMultiStickerSheet: 'false',
        },
      });
    } catch (error) {
      console.error('Error generating sheet:', error);
      Alert.alert('Error', 'Failed to generate sticker sheet. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateRepeatedStickerSheet = async (
    stickerImageUri: string,
    sheetSize: SheetSize,
    stickerCount: number,
    grid: [number, number]
  ): Promise<string> => {
    const layout = STICKER_SHEET_LAYOUTS[sheetSize as LayoutSheetSize];
    const [cols, rows] = grid;

    if (Platform.OS === 'web') {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = layout.sheetSizePixels;
        canvas.height = layout.sheetSizePixels;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Fill background
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw printable area
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(
          SHEET_CONSTANTS.OUTER_MARGIN_PIXELS,
          SHEET_CONSTANTS.OUTER_MARGIN_PIXELS,
          layout.sheetSizePixels - 2 * SHEET_CONSTANTS.OUTER_MARGIN_PIXELS,
          layout.sheetSizePixels - 2 * SHEET_CONSTANTS.OUTER_MARGIN_PIXELS
        );

        const img = new (window as any).Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          const stickerOption = layout.options.find(opt => opt.count === stickerCount);
          if (!stickerOption) {
            reject(new Error('Invalid sticker count'));
            return;
          }

          const stickerSizePixels = stickerOption.stickerSizePixels;
          const gutterPixels = SHEET_CONSTANTS.GUTTER_PIXELS;
          const marginPixels = SHEET_CONSTANTS.OUTER_MARGIN_PIXELS;

          const totalGridWidth = cols * stickerSizePixels + (cols - 1) * gutterPixels;
          const totalGridHeight = rows * stickerSizePixels + (rows - 1) * gutterPixels;
          const usableWidth = layout.sheetSizePixels - 2 * marginPixels;
          const usableHeight = layout.sheetSizePixels - 2 * marginPixels;
          
          const startX = marginPixels + Math.max(0, (usableWidth - totalGridWidth) / 2);
          const startY = marginPixels + Math.max(0, (usableHeight - totalGridHeight) / 2);

          let drawn = 0;
          for (let row = 0; row < rows && drawn < stickerCount; row++) {
            for (let col = 0; col < cols && drawn < stickerCount; col++) {
              const x = startX + col * (stickerSizePixels + gutterPixels);
              const y = startY + row * (stickerSizePixels + gutterPixels);
              
              ctx.drawImage(img, x, y, stickerSizePixels, stickerSizePixels);
              drawn++;
            }
          }
          
          resolve(canvas.toDataURL('image/png'));
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load sticker image'));
        };
        
        img.src = stickerImageUri;
      });
    } else {
      // For mobile, we'll need to use a different approach
      // For now, return the original image and handle it in checkout
      return stickerImageUri;
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
              <Text style={styles.introTitle}>Custom Sticker Sheets</Text>
              <Text style={styles.introDescription}>
                Choose your sheet size and sticker count. Each sticker is sized perfectly 
                for planners, journals, and crafts.
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
                      <Text style={styles.detailLabel}>Sheet Size:</Text>
                      <Text style={styles.detailValue}>{config.displayName}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Available Options:</Text>
                      <Text style={styles.detailValue}>
                        {dynamicLayouts[config.size]?.options.length || STICKER_SHEET_LAYOUTS[config.size as LayoutSheetSize].options.length} layouts
                      </Text>
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

            {selectedSize && (
              <View style={styles.stickerCountSection}>
                <View style={styles.sectionHeader}>
                  <Layers size={24} color={neutralColors.primary} />
                  <Text style={styles.sectionTitle}>Choose Sticker Count</Text>
                </View>
                <Text style={styles.sectionDescription}>
                  {currentDynamicLayout
                    ? `Optimized for your sticker's ${currentDynamicLayout.stickerDimensions.aspectRatio.toFixed(2)}:1 aspect ratio`
                    : `Select how many stickers you want on your ${currentLayout.displayName} sheet`}
                </Text>
                
                <View style={styles.countOptionsContainer}>
                  {(currentDynamicLayout?.options || currentLayout.options).map((option) => (
                    <TouchableOpacity
                      key={option.count}
                      style={[
                        styles.countOption,
                        currentStickerCount === option.count && styles.countOptionSelected,
                      ]}
                      onPress={() => setSelectedStickerCount(option.count)}
                      disabled={isGenerating}
                      activeOpacity={0.7}
                    >
                      <View style={styles.countOptionHeader}>
                        <Text style={[
                          styles.countOptionName,
                          currentStickerCount === option.count && styles.countOptionNameSelected,
                        ]}>
                          {option.displayName}
                        </Text>
                        {currentStickerCount === option.count && (
                          <View style={styles.countCheckmark}>
                            <Check size={16} color={neutralColors.white} />
                          </View>
                        )}
                      </View>
                      <Text style={styles.countOptionDescription}>{option.description}</Text>
                      <View style={styles.countOptionDetails}>
                        <Text style={styles.countOptionDetail}>
                          {option.grid[0]}×{option.grid[1]} grid
                        </Text>
                        <Text style={styles.countOptionDetail}>•</Text>
                        <Text style={styles.countOptionDetail}>
                          {option.count} stickers
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

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
                  Create Sheet ({currentStickerCount} stickers)
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
  stickerCountSection: {
    marginBottom: 32,
    backgroundColor: neutralColors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: neutralColors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: neutralColors.text.primary,
  },
  sectionDescription: {
    fontSize: 14,
    color: neutralColors.text.secondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  countOptionsContainer: {
    gap: 12,
  },
  countOption: {
    backgroundColor: neutralColors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: neutralColors.border,
  },
  countOptionSelected: {
    borderColor: neutralColors.primary,
    backgroundColor: neutralColors.primary + '08',
  },
  countOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  countOptionName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
  },
  countOptionNameSelected: {
    color: neutralColors.primary,
  },
  countCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: neutralColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countOptionDescription: {
    fontSize: 13,
    color: neutralColors.text.secondary,
    marginBottom: 8,
  },
  countOptionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countOptionDetail: {
    fontSize: 12,
    color: neutralColors.text.secondary,
    fontWeight: '500' as const,
  },
});
