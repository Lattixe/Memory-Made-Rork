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
    console.warn(`[StickerSheetPreview] No matching option found for ${sheetSize} with ${stickerCount} stickers`);
    console.warn(`[StickerSheetPreview] Available options:`, layout.options.map(o => o.count));
    return (
      <View style={styles.container} testID="sticker-sheet-preview-error">
        <Text style={styles.errorText}>Invalid sticker configuration</Text>
        <Text style={styles.errorDetails}>
          {sheetSize} sheet with {stickerCount} stickers is not available
        </Text>
      </View>
    );
  }

  const [cols, rows] = stickerOption.grid;
  const stickers: number[] = [];
  for (let i = 0; i < stickerCount; i++) {
    stickers.push(i);
  }

  return (
    <View style={styles.container} testID="sticker-sheet-preview-root">
      <View style={styles.sheetBorder}>
        <View style={styles.sheetCanvas} testID="sticker-sheet-canvas">
          <View style={styles.gridContainer}>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.gridRow}>
                {Array.from({ length: cols }).map((_, colIndex) => {
                  const stickerIndex = rowIndex * cols + colIndex;
                  const isVisible = stickerIndex < stickerCount;
                  
                  return (
                    <View
                      key={`sticker-${rowIndex}-${colIndex}`}
                      style={[
                        styles.stickerCell,
                        { flex: 1 / cols },
                      ]}
                    >
                      {isVisible && (
                        <View style={styles.stickerWrapper}>
                          <Image
                            source={{ uri: stickerImage }}
                            style={styles.stickerImage}
                            resizeMode="contain"
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
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
  sheetBorder: {
    backgroundColor: neutralColors.white,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: neutralColors.border,
  },
  sheetCanvas: {
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    overflow: 'hidden',
    aspectRatio: 1,
    padding: 8,
  },
  gridContainer: {
    flex: 1,
    gap: 6,
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  stickerCell: {
    aspectRatio: 1,
  },
  stickerWrapper: {
    flex: 1,
  },
  stickerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: neutralColors.text.secondary,
    textAlign: 'center',
    padding: 20,
  },
  errorDetails: {
    fontSize: 12,
    color: neutralColors.text.tertiary,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
