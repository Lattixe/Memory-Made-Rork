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
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Grid3X3 } from 'lucide-react-native';
import { neutralColors } from '@/constants/colors';
import { STICKER_SHEET_LAYOUTS, SHEET_CONSTANTS, SheetSize as LayoutSheetSize } from '@/constants/stickerSheetLayouts';
import {
  getStickerDimensions,
  calculateDynamicLayouts,
  generateDynamicStickerSheet,
  DynamicSheetLayout,
} from '@/utils/dynamicStickerLayout';
import { router, useLocalSearchParams } from 'expo-router';
import StickerSheetPreview from '@/components/StickerSheetPreview';

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

const filterValidOptions = (layout: DynamicSheetLayout, size: SheetSize): DynamicSheetLayout | null => {
  const staticLayout = STICKER_SHEET_LAYOUTS[size as LayoutSheetSize];
  const validCounts = new Set(staticLayout.options.map(opt => opt.count));
  
  const validOptions = layout.options.filter(opt => validCounts.has(opt.count));
  
  if (validOptions.length === 0) {
    console.warn(`[Dynamic Layout] No valid options for ${size}, falling back to static layout`);
    return null;
  }
  
  const validRecommended = validOptions.find(opt => opt.count === layout.recommendedOption.count) || validOptions[0];
  
  return {
    ...layout,
    options: validOptions,
    recommendedOption: validRecommended,
  };
};

export default function SheetSizeSelectionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const stickerImage = typeof params.stickerImage === 'string' ? params.stickerImage : '';
  const originalImage = typeof params.originalImage === 'string' ? params.originalImage : '';

  const [selectedSize, setSelectedSize] = useState<SheetSize>('4x4');
  const [selectedStickerCount, setSelectedStickerCount] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [dynamicLayouts, setDynamicLayouts] = useState<Record<SheetSize, DynamicSheetLayout | null>>({
    '3x3': null,
    '4x4': null,
    '5.5x5.5': null,
  });
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(true);

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
        
        const validatedLayouts: Record<SheetSize, DynamicSheetLayout | null> = {
          '3x3': layouts['3x3'] ? filterValidOptions(layouts['3x3'], '3x3') : null,
          '4x4': layouts['4x4'] ? filterValidOptions(layouts['4x4'], '4x4') : null,
          '5.5x5.5': layouts['5.5x5.5'] ? filterValidOptions(layouts['5.5x5.5'], '5.5x5.5') : null,
        };
        
        console.log('[Dynamic Layout] Validated layouts:', validatedLayouts);
        setDynamicLayouts(validatedLayouts);
      } catch (error) {
        console.error('[Dynamic Layout] Error analyzing sticker:', error);
      } finally {
        setIsAnalyzing(false);
      }
    }
    
    analyzeStickerDimensions();
  }, [stickerImage]);

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

  const screenWidth = Dimensions.get('window').width;
  const previewSize = Math.min(screenWidth - 80, 280);

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
                Choose your sheet size and sticker count.
                {currentDynamicLayout && (
                  <Text style={styles.aspectRatioText}>
                    {' '}Optimized for your {currentDynamicLayout.stickerDimensions.aspectRatio.toFixed(2)}:1 sticker.
                  </Text>
                )}
              </Text>
            </View>

            <View style={[styles.previewContainer, { height: previewSize + 40 }]}>
              {isAnalyzing ? (
                <View style={styles.loadingPreview}>
                  <ActivityIndicator size="large" color={neutralColors.primary} />
                  <Text style={styles.loadingText}>Analyzing sticker...</Text>
                </View>
              ) : (
                <View style={[styles.previewWrapper, { width: previewSize, height: previewSize }]}>
                  <StickerSheetPreview
                    stickerImage={stickerImage}
                    sheetSize={selectedSize}
                    stickerCount={currentStickerCount}
                  />
                </View>
              )}
            </View>

            <View style={styles.configSection}>
              <View style={styles.configHeader}>
                <Text style={styles.configTitle}>Sheet Size</Text>
                <Text style={styles.configValue}>
                  {SHEET_CONFIGS.find(c => c.size === selectedSize)?.displayName}
                </Text>
              </View>
              
              <View style={styles.sizeSelector}>
                {SHEET_CONFIGS.map((config) => (
                  <TouchableOpacity
                    key={config.size}
                    style={[
                      styles.sizeButton,
                      selectedSize === config.size && styles.sizeButtonSelected,
                    ]}
                    onPress={() => setSelectedSize(config.size)}
                    disabled={isGenerating}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.sizeButtonText,
                      selectedSize === config.size && styles.sizeButtonTextSelected,
                    ]}>
                      {config.displayName}
                    </Text>
                    <Text style={[
                      styles.sizeButtonPrice,
                      selectedSize === config.size && styles.sizeButtonPriceSelected,
                    ]}>
                      ${config.price.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.configSection}>
              <View style={styles.configHeader}>
                <Text style={styles.configTitle}>Sticker Count</Text>
                <Text style={styles.configValue}>
                  {currentStickerCount} stickers
                </Text>
              </View>
              
              <View style={styles.countSelector}>
                {(currentDynamicLayout?.options || currentLayout.options).map((option) => (
                  <TouchableOpacity
                    key={option.count}
                    style={[
                      styles.countButton,
                      currentStickerCount === option.count && styles.countButtonSelected,
                    ]}
                    onPress={() => setSelectedStickerCount(option.count)}
                    disabled={isGenerating}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.countButtonNumber,
                      currentStickerCount === option.count && styles.countButtonNumberSelected,
                    ]}>
                      {option.count}
                    </Text>
                    <Text style={[
                      styles.countButtonLabel,
                      currentStickerCount === option.count && styles.countButtonLabelSelected,
                    ]}>
                      {option.displayName}
                    </Text>
                    <Text style={[
                      styles.countButtonGrid,
                      currentStickerCount === option.count && styles.countButtonGridSelected,
                    ]}>
                      {option.grid[0]}×{option.grid[1]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Sheet Size</Text>
                <Text style={styles.summaryValue}>
                  {SHEET_CONFIGS.find(c => c.size === selectedSize)?.displayName}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Stickers</Text>
                <Text style={styles.summaryValue}>{currentStickerCount}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Grid Layout</Text>
                <Text style={styles.summaryValue}>
                  {(currentDynamicLayout?.options || currentLayout.options)
                    .find(opt => opt.count === currentStickerCount)?.grid.join(' × ')}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryRowTotal]}>
                <Text style={styles.summaryLabelTotal}>Total Price</Text>
                <Text style={styles.summaryValueTotal}>
                  ${SHEET_CONFIGS.find(c => c.size === selectedSize)?.price.toFixed(2)}
                </Text>
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
    marginBottom: 24,
    paddingVertical: 16,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: neutralColors.text.primary,
    marginTop: 12,
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
  aspectRatioText: {
    fontSize: 14,
    color: neutralColors.primary,
    fontWeight: '600' as const,
  },
  previewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    paddingVertical: 20,
  },
  loadingPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: neutralColors.text.secondary,
  },
  previewWrapper: {
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  configSection: {
    marginBottom: 24,
  },
  configHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  configTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
  },
  configValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: neutralColors.primary,
  },
  sizeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  sizeButton: {
    flex: 1,
    backgroundColor: neutralColors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: neutralColors.border,
    alignItems: 'center',
  },
  sizeButtonSelected: {
    borderColor: neutralColors.primary,
    backgroundColor: neutralColors.primary + '08',
  },
  sizeButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: neutralColors.text.primary,
    marginBottom: 4,
  },
  sizeButtonTextSelected: {
    color: neutralColors.primary,
  },
  sizeButtonPrice: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: neutralColors.text.secondary,
  },
  sizeButtonPriceSelected: {
    color: neutralColors.primary,
  },
  countSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  countButton: {
    backgroundColor: neutralColors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: neutralColors.border,
    minWidth: 80,
    alignItems: 'center',
  },
  countButtonSelected: {
    borderColor: neutralColors.primary,
    backgroundColor: neutralColors.primary + '08',
  },
  countButtonNumber: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: neutralColors.text.primary,
    marginBottom: 2,
  },
  countButtonNumberSelected: {
    color: neutralColors.primary,
  },
  countButtonLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: neutralColors.text.secondary,
    marginBottom: 2,
  },
  countButtonLabelSelected: {
    color: neutralColors.primary,
  },
  countButtonGrid: {
    fontSize: 10,
    color: neutralColors.text.tertiary,
  },
  countButtonGridSelected: {
    color: neutralColors.primary,
  },
  summaryCard: {
    backgroundColor: neutralColors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: neutralColors.border,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: neutralColors.border,
  },
  summaryRowTotal: {
    borderBottomWidth: 0,
    paddingTop: 16,
    marginTop: 6,
    borderTopWidth: 2,
    borderTopColor: neutralColors.border,
  },
  summaryLabel: {
    fontSize: 14,
    color: neutralColors.text.secondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
  },
  summaryLabelTotal: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
  },
  summaryValueTotal: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: neutralColors.primary,
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
