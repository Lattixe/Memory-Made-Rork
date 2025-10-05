import { Platform, Image } from 'react-native';

export type SheetSize = '3x3' | '4x4' | '5.5x5.5';

export type StickerDimensions = {
  width: number;
  height: number;
  aspectRatio: number;
};

export type DynamicLayoutOption = {
  count: number;
  grid: [number, number];
  stickerWidthInches: number;
  stickerHeightInches: number;
  stickerWidthPixels: number;
  stickerHeightPixels: number;
  displayName: string;
  description: string;
  efficiency: number;
};

export type DynamicSheetLayout = {
  sheetSize: SheetSize;
  sheetSizeInches: number;
  sheetSizePixels: number;
  stickerDimensions: StickerDimensions;
  options: DynamicLayoutOption[];
  recommendedOption: DynamicLayoutOption;
};

const SHEET_SIZES: Record<SheetSize, number> = {
  '3x3': 3.0,
  '4x4': 4.0,
  '5.5x5.5': 5.5,
};

const OUTER_MARGIN_INCHES = 0.125;
const GUTTER_INCHES = 0.08;
const DPI = 300;
const MIN_STICKER_SIZE_INCHES = 0.35;
const MAX_STICKER_SIZE_INCHES = 2.5;

export async function getStickerDimensions(imageUri: string): Promise<StickerDimensions> {
  return new Promise((resolve, reject) => {
    if (Platform.OS === 'web') {
      const img = new (window as any).Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
          aspectRatio: img.width / img.height,
        });
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = imageUri;
    } else {
      Image.getSize(
        imageUri,
        (width: number, height: number) => {
          resolve({
            width,
            height,
            aspectRatio: width / height,
          });
        },
        (error: Error) => {
          reject(error);
        }
      );
    }
  });
}

function calculateLayoutForGrid(
  sheetSizeInches: number,
  cols: number,
  rows: number,
  aspectRatio: number
): {
  widthInches: number;
  heightInches: number;
  widthPixels: number;
  heightPixels: number;
  efficiency: number;
} | null {
  const usableWidth = sheetSizeInches - 2 * OUTER_MARGIN_INCHES;
  const usableHeight = sheetSizeInches - 2 * OUTER_MARGIN_INCHES;
  
  const availableWidthPerSticker = (usableWidth - (cols - 1) * GUTTER_INCHES) / cols;
  const availableHeightPerSticker = (usableHeight - (rows - 1) * GUTTER_INCHES) / rows;
  
  let stickerWidth: number;
  let stickerHeight: number;
  
  if (aspectRatio >= 1) {
    stickerWidth = Math.min(availableWidthPerSticker, availableHeightPerSticker * aspectRatio);
    stickerHeight = stickerWidth / aspectRatio;
  } else {
    stickerHeight = Math.min(availableHeightPerSticker, availableWidthPerSticker / aspectRatio);
    stickerWidth = stickerHeight * aspectRatio;
  }
  
  if (
    stickerWidth < MIN_STICKER_SIZE_INCHES ||
    stickerHeight < MIN_STICKER_SIZE_INCHES ||
    stickerWidth > MAX_STICKER_SIZE_INCHES ||
    stickerHeight > MAX_STICKER_SIZE_INCHES
  ) {
    return null;
  }
  
  const totalStickerArea = cols * rows * stickerWidth * stickerHeight;
  const usableArea = usableWidth * usableHeight;
  const efficiency = totalStickerArea / usableArea;
  
  return {
    widthInches: stickerWidth,
    heightInches: stickerHeight,
    widthPixels: Math.round(stickerWidth * DPI),
    heightPixels: Math.round(stickerHeight * DPI),
    efficiency,
  };
}

export function calculateDynamicLayouts(
  sheetSize: SheetSize,
  stickerDimensions: StickerDimensions
): DynamicSheetLayout {
  const sheetSizeInches = SHEET_SIZES[sheetSize];
  const sheetSizePixels = sheetSizeInches * DPI;
  const { aspectRatio } = stickerDimensions;
  
  const options: DynamicLayoutOption[] = [];
  
  const maxGridSize = sheetSize === '5.5x5.5' ? 8 : sheetSize === '4x4' ? 7 : 6;
  
  for (let cols = 2; cols <= maxGridSize; cols++) {
    for (let rows = 2; rows <= maxGridSize; rows++) {
      const layout = calculateLayoutForGrid(sheetSizeInches, cols, rows, aspectRatio);
      
      if (layout) {
        const count = cols * rows;
        const avgSize = (layout.widthInches + layout.heightInches) / 2;
        
        let sizeName: string;
        if (avgSize < 0.5) sizeName = 'Micro';
        else if (avgSize < 0.7) sizeName = 'Mini';
        else if (avgSize < 0.9) sizeName = 'Small';
        else if (avgSize < 1.2) sizeName = 'Medium';
        else sizeName = 'Large';
        
        options.push({
          count,
          grid: [cols, rows],
          stickerWidthInches: layout.widthInches,
          stickerHeightInches: layout.heightInches,
          stickerWidthPixels: layout.widthPixels,
          stickerHeightPixels: layout.heightPixels,
          displayName: `${sizeName} (${count})`,
          description: `${cols}×${rows} grid • ~${layout.widthInches.toFixed(2)}"×${layout.heightInches.toFixed(2)}"`,
          efficiency: layout.efficiency,
        });
      }
    }
  }
  
  options.sort((a, b) => {
    const effDiff = b.efficiency - a.efficiency;
    if (Math.abs(effDiff) > 0.05) return effDiff;
    return b.count - a.count;
  });
  
  const uniqueOptions = options.filter((option, index, self) => {
    return index === self.findIndex(o => o.count === option.count);
  });
  
  const topOptions = uniqueOptions.slice(0, 6);
  
  const recommendedOption = topOptions.reduce((best, current) => {
    const bestScore = best.efficiency * 0.7 + (best.count / 50) * 0.3;
    const currentScore = current.efficiency * 0.7 + (current.count / 50) * 0.3;
    return currentScore > bestScore ? current : best;
  }, topOptions[0]);
  
  return {
    sheetSize,
    sheetSizeInches,
    sheetSizePixels,
    stickerDimensions,
    options: topOptions,
    recommendedOption,
  };
}

export async function generateDynamicStickerSheet(
  stickerImageUri: string,
  sheetSize: SheetSize,
  layout: DynamicLayoutOption
): Promise<string> {
  if (Platform.OS !== 'web') {
    return stickerImageUri;
  }
  
  const sheetSizeInches = SHEET_SIZES[sheetSize];
  const sheetSizePixels = sheetSizeInches * DPI;
  
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = sheetSizePixels;
    canvas.height = sheetSizePixels;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const marginPixels = Math.round(OUTER_MARGIN_INCHES * DPI);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      marginPixels,
      marginPixels,
      sheetSizePixels - 2 * marginPixels,
      sheetSizePixels - 2 * marginPixels
    );
    
    const img = new (window as any).Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const [cols, rows] = layout.grid;
      const gutterPixels = Math.round(GUTTER_INCHES * DPI);
      
      const totalGridWidth = cols * layout.stickerWidthPixels + (cols - 1) * gutterPixels;
      const totalGridHeight = rows * layout.stickerHeightPixels + (rows - 1) * gutterPixels;
      const usableWidth = sheetSizePixels - 2 * marginPixels;
      const usableHeight = sheetSizePixels - 2 * marginPixels;
      
      const startX = marginPixels + Math.max(0, (usableWidth - totalGridWidth) / 2);
      const startY = marginPixels + Math.max(0, (usableHeight - totalGridHeight) / 2);
      
      let drawn = 0;
      for (let row = 0; row < rows && drawn < layout.count; row++) {
        for (let col = 0; col < cols && drawn < layout.count; col++) {
          const x = startX + col * (layout.stickerWidthPixels + gutterPixels);
          const y = startY + row * (layout.stickerHeightPixels + gutterPixels);
          
          ctx.drawImage(
            img,
            x,
            y,
            layout.stickerWidthPixels,
            layout.stickerHeightPixels
          );
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
}
