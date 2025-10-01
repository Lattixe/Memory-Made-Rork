import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { neutralColors } from '@/constants/colors';

type SheetSize = '3x3' | '4x4' | '5.5x5.5';

type StickerSheetPreviewProps = {
  stickerImage: string;
  sheetSize: SheetSize;
  stickerCount: number;
};

const SHEET_CONFIGS = {
  '3x3': {
    displayName: '3" × 3"',
    cellsPerSide: 9,
    totalMinis: 81,
  },
  '4x4': {
    displayName: '4" × 4"',
    cellsPerSide: 12,
    totalMinis: 144,
  },
  '5.5x5.5': {
    displayName: '5.5" × 5.5"',
    cellsPerSide: 17,
    totalMinis: 289,
  },
};

export default function StickerSheetPreview({
  stickerImage,
  sheetSize,
  stickerCount,
}: StickerSheetPreviewProps) {
  const config = SHEET_CONFIGS[sheetSize];

  const gridItems = useMemo(() => {
    return Array.from({ length: config.totalMinis }, (_, i) => i);
  }, [config.totalMinis]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sticker Sheet Preview</Text>
        <Text style={styles.subtitle}>
          {config.displayName} • {config.totalMinis} mini stickers (0.25&quot; × 0.25&quot; each)
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sheetContainer}>
          <View style={styles.sheetBorder}>
            <View
              style={[
                styles.grid,
                {
                  aspectRatio: 1,
                },
              ]}
            >
              {gridItems.map((index) => (
                <View
                  key={index}
                  style={[
                    styles.gridCell,
                    {
                      width: `${100 / config.cellsPerSide}%`,
                      aspectRatio: 1,
                    },
                  ]}
                >
                  <View style={styles.miniStickerContainer}>
                    <Image
                      source={{ uri: stickerImage }}
                      style={styles.miniSticker}
                      resizeMode="contain"
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>What You&apos;ll Receive:</Text>
            <View style={styles.infoList}>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>✓</Text>
                <Text style={styles.infoText}>
                  One {config.displayName} kiss-cut sticker sheet
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>✓</Text>
                <Text style={styles.infoText}>
                  {config.totalMinis} individual mini stickers (0.25&quot; × 0.25&quot;)
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>✓</Text>
                <Text style={styles.infoText}>
                  Each sticker peels off independently
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>✓</Text>
                <Text style={styles.infoText}>
                  White border around each mini sticker
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>✓</Text>
                <Text style={styles.infoText}>
                  High-quality 300 DPI print on premium vinyl
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>✓</Text>
                <Text style={styles.infoText}>
                  Waterproof and durable for planners & journals
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.specsCard}>
            <Text style={styles.specsTitle}>Technical Specifications:</Text>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Sheet Size:</Text>
              <Text style={styles.specValue}>{config.displayName}</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Grid Layout:</Text>
              <Text style={styles.specValue}>
                {config.cellsPerSide} × {config.cellsPerSide}
              </Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Mini Sticker Size:</Text>
              <Text style={styles.specValue}>0.25&quot; × 0.25&quot;</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Total Stickers:</Text>
              <Text style={styles.specValue}>{config.totalMinis}</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Print Quality:</Text>
              <Text style={styles.specValue}>300 DPI</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Material:</Text>
              <Text style={styles.specValue}>Premium Vinyl</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: neutralColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: neutralColors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: neutralColors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: neutralColors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  sheetContainer: {
    marginBottom: 24,
  },
  sheetBorder: {
    backgroundColor: neutralColors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: neutralColors.border,
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: neutralColors.background,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gridCell: {
    padding: 1,
  },
  miniStickerContainer: {
    flex: 1,
    backgroundColor: neutralColors.white,
    borderRadius: 2,
    padding: 2,
    borderWidth: 0.5,
    borderColor: neutralColors.border,
  },
  miniSticker: {
    width: '100%',
    height: '100%',
  },
  infoSection: {
    gap: 16,
  },
  infoCard: {
    backgroundColor: neutralColors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: neutralColors.border,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: neutralColors.text.primary,
    marginBottom: 16,
  },
  infoList: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoBullet: {
    fontSize: 16,
    color: neutralColors.primary,
    fontWeight: '700' as const,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: neutralColors.text.secondary,
    lineHeight: 20,
  },
  specsCard: {
    backgroundColor: neutralColors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: neutralColors.border,
  },
  specsTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: neutralColors.text.primary,
    marginBottom: 16,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: neutralColors.border,
  },
  specLabel: {
    fontSize: 14,
    color: neutralColors.text.secondary,
  },
  specValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
  },
});
