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
      <View style={styles.container} testID="sticker-sheet-preview-error">
        <Text style={styles.errorText}>Invalid sticker configuration</Text>
      </View>
    );
  }

  const [cols, rows] = stickerOption.grid;
  const aspect = cols && rows ? cols / rows : 1;

  return (
    <View style={styles.container} testID="sticker-sheet-preview-root">
      <View style={styles.sheetBorder}>
        <View
          style={[
            styles.sheetCanvas,
            { aspectRatio: aspect },
          ]}
          testID="sticker-sheet-canvas"
        >
          <Image
            source={{ uri: stickerImage }}
            style={styles.sheetImage}
            resizeMode="contain"
          />
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
    backgroundColor: neutralColors.background,
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
  },
  sheetImage: {
    width: '100%',
    height: '100%',
  },
  errorText: {
    fontSize: 14,
    color: neutralColors.text.secondary,
    textAlign: 'center',
    padding: 20,
  },
});
