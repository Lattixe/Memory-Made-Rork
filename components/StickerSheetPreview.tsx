import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { neutralColors } from '@/constants/colors';
import { SheetSize } from '@/constants/stickerSheetLayouts';

type StickerSheetPreviewProps = {
  stickerImage: string;
  sheetSize: SheetSize;
  stickerCount: number;
};

export default function StickerSheetPreview({
  stickerImage,
}: StickerSheetPreviewProps) {
  return (
    <View style={styles.container} testID="sticker-sheet-preview-root">
      <View style={styles.sheetBorder}>
        <View style={styles.sheetCanvas} testID="sticker-sheet-canvas">
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
    width: '100%',
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
  },
  sheetImage: {
    width: '100%',
    height: '100%',
  },
});
