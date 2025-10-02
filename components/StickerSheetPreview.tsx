import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { neutralColors } from '@/constants/colors';
import { STICKER_SHEET_LAYOUTS, getStickerOption, SheetSize } from '@/constants/stickerSheetLayouts';

type StickerSheetPreviewProps = {
  stickerImage: string;
  sheetSize: SheetSize;
  stickerCount: number;
};

export default function StickerSheetPreview({
  stickerImage,
  sheetSize,
  stickerCount,
}: StickerSheetPreviewProps) {
  const layout = STICKER_SHEET_LAYOUTS[sheetSize];
  const stickerOption = getStickerOption(sheetSize, stickerCount);
  
  if (!stickerOption) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Invalid sticker configuration</Text>
      </View>
    );
  }

  const [cols] = stickerOption.grid;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sticker Sheet Preview</Text>
        <Text style={styles.subtitle}>
          {layout.displayName} • {stickerCount} stickers ({stickerOption.stickerSizeInches.toFixed(2)}&quot; × {stickerOption.stickerSizeInches.toFixed(2)}&quot; each)
        </Text>
      </View>

      <View style={styles.previewContainer}>
        <View style={styles.sheetBorder}>
          <View
            style={[
              styles.grid,
              {
                aspectRatio: 1,
              },
            ]}
          >
            {Array.from({ length: stickerCount }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.gridCell,
                  {
                    width: `${100 / cols}%`,
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

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>What You&apos;ll Receive:</Text>
            <View style={styles.infoList}>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>✓</Text>
                <Text style={styles.infoText}>
                  One {layout.displayName} kiss-cut sticker sheet
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>✓</Text>
                <Text style={styles.infoText}>
                  {stickerCount} individual stickers ({stickerOption.stickerSizeInches.toFixed(2)}&quot; × {stickerOption.stickerSizeInches.toFixed(2)}&quot;)
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>✓</Text>
                <Text style={styles.infoText}>
                  Each sticker peels off independently
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: neutralColors.text.secondary,
  },
  previewContainer: {
    gap: 16,
  },
  sheetBorder: {
    backgroundColor: neutralColors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: neutralColors.border,
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
    gap: 12,
  },
  infoCard: {
    backgroundColor: neutralColors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: neutralColors.border,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
    marginBottom: 12,
  },
  infoList: {
    gap: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoBullet: {
    fontSize: 14,
    color: neutralColors.primary,
    fontWeight: '600' as const,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: neutralColors.text.secondary,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 14,
    color: neutralColors.text.secondary,
    textAlign: 'center',
    padding: 20,
  },
});
