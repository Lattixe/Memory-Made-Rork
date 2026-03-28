// Dynamic sticker sheet layout configurations
// Based on the new grid system with configurable sticker counts per sheet size

export type SheetSize = '3x3' | '4x4' | '5.5x5.5';

export type StickerCountOption = {
  count: number;
  grid: [number, number]; // [cols, rows]
  stickerSizeInches: number;
  stickerSizePixels: number;
  displayName: string;
  description: string;
};

// Global constants - Printful compliant
const OUTER_MARGIN_INCHES = 0.125;
const GUTTER_INCHES = 0.25;
const DPI = 300;

// Formula: a = (U - (N - 1) * G) / N
// Where: U = usable width/height, N = stickers per row/col, G = gutter
function calculateStickerSize(
  sheetSizeInches: number,
  stickersPerSide: number
): { sizeInches: number; sizePixels: number } {
  const usableSize = sheetSizeInches - 2 * OUTER_MARGIN_INCHES;
  const sizeInches = (usableSize - (stickersPerSide - 1) * GUTTER_INCHES) / stickersPerSide;
  const sizePixels = Math.round(sizeInches * DPI);
  
  return { sizeInches, sizePixels };
}

// 3" × 3" sheet options (U = 2.75")
const SHEET_3X3_OPTIONS: StickerCountOption[] = [
  (() => {
    const { sizeInches, sizePixels } = calculateStickerSize(3.0, 6);
    return {
      count: 36,
      grid: [6, 6] as [number, number],
      stickerSizeInches: sizeInches,
      stickerSizePixels: sizePixels,
      displayName: 'Micro (36)',
      description: '6×6 grid • ~0.39" per sticker',
    };
  })(),
  (() => {
    const { sizeInches, sizePixels } = calculateStickerSize(3.0, 5);
    return {
      count: 25,
      grid: [5, 5] as [number, number],
      stickerSizeInches: sizeInches,
      stickerSizePixels: sizePixels,
      displayName: 'Small (25)',
      description: '5×5 grid • ~0.49" per sticker',
    };
  })(),
  (() => {
    const { sizeInches, sizePixels } = calculateStickerSize(3.0, 4);
    return {
      count: 16,
      grid: [4, 4] as [number, number],
      stickerSizeInches: sizeInches,
      stickerSizePixels: sizePixels,
      displayName: 'Medium (16)',
      description: '4×4 grid • ~0.63" per sticker',
    };
  })(),
  (() => {
    const { sizeInches, sizePixels } = calculateStickerSize(3.0, 3);
    return {
      count: 9,
      grid: [3, 3] as [number, number],
      stickerSizeInches: sizeInches,
      stickerSizePixels: sizePixels,
      displayName: 'Large (9)',
      description: '3×3 grid • ~0.86" per sticker',
    };
  })(),
];

// 4" × 4" sheet options (U = 3.75")
const SHEET_4X4_OPTIONS: StickerCountOption[] = [
  (() => {
    const { sizeInches, sizePixels } = calculateStickerSize(4.0, 6);
    return {
      count: 36,
      grid: [6, 6] as [number, number],
      stickerSizeInches: sizeInches,
      stickerSizePixels: sizePixels,
      displayName: 'Micro (36)',
      description: '6×6 grid • ~0.56" per sticker',
    };
  })(),
  (() => {
    const { sizeInches, sizePixels } = calculateStickerSize(4.0, 5);
    return {
      count: 25,
      grid: [5, 5] as [number, number],
      stickerSizeInches: sizeInches,
      stickerSizePixels: sizePixels,
      displayName: 'Small (25)',
      description: '5×5 grid • ~0.69" per sticker',
    };
  })(),
  (() => {
    const { sizeInches, sizePixels } = calculateStickerSize(4.0, 4);
    return {
      count: 16,
      grid: [4, 4] as [number, number],
      stickerSizeInches: sizeInches,
      stickerSizePixels: sizePixels,
      displayName: 'Medium (16)',
      description: '4×4 grid • ~0.88" per sticker',
    };
  })(),
];

// 5.5" × 5.5" sheet options (U = 5.25")
const SHEET_5_5X5_5_OPTIONS: StickerCountOption[] = [
  (() => {
    const { sizeInches, sizePixels } = calculateStickerSize(5.5, 7);
    return {
      count: 49,
      grid: [7, 7] as [number, number],
      stickerSizeInches: sizeInches,
      stickerSizePixels: sizePixels,
      displayName: 'Micro (49)',
      description: '7×7 grid • ~0.68" per sticker',
    };
  })(),
  (() => {
    const { sizeInches, sizePixels } = calculateStickerSize(5.5, 6);
    return {
      count: 36,
      grid: [6, 6] as [number, number],
      stickerSizeInches: sizeInches,
      stickerSizePixels: sizePixels,
      displayName: 'Small (36)',
      description: '6×6 grid • ~0.81" per sticker',
    };
  })(),
  (() => {
    const { sizeInches, sizePixels } = calculateStickerSize(5.5, 5);
    return {
      count: 25,
      grid: [5, 5] as [number, number],
      stickerSizeInches: sizeInches,
      stickerSizePixels: sizePixels,
      displayName: 'Medium (25)',
      description: '5×5 grid • ~0.99" per sticker',
    };
  })(),
  (() => {
    const { sizeInches, sizePixels } = calculateStickerSize(5.5, 4);
    return {
      count: 16,
      grid: [4, 4] as [number, number],
      stickerSizeInches: sizeInches,
      stickerSizePixels: sizePixels,
      displayName: 'Large (16)',
      description: '4×4 grid • ~1.25" per sticker',
    };
  })(),
];

export const STICKER_SHEET_LAYOUTS = {
  '3x3': {
    sheetSizeInches: 3.0,
    sheetSizePixels: 3.0 * DPI,
    displayName: '3" × 3"',
    options: SHEET_3X3_OPTIONS,
    defaultOption: SHEET_3X3_OPTIONS[1], // 5×5 (25) is balanced
  },
  '4x4': {
    sheetSizeInches: 4.0,
    sheetSizePixels: 4.0 * DPI,
    displayName: '4" × 4"',
    options: SHEET_4X4_OPTIONS,
    defaultOption: SHEET_4X4_OPTIONS[0], // 6×6 (36) for lots of stickers
  },
  '5.5x5.5': {
    sheetSizeInches: 5.5,
    sheetSizePixels: 5.5 * DPI,
    displayName: '5.5" × 5.5"',
    options: SHEET_5_5X5_5_OPTIONS,
    defaultOption: SHEET_5_5X5_5_OPTIONS[1], // 6×6 (36) is sweet spot
  },
} as const;

export const SHEET_CONSTANTS = {
  OUTER_MARGIN_INCHES,
  GUTTER_INCHES,
  DPI,
  OUTER_MARGIN_PIXELS: Math.round(OUTER_MARGIN_INCHES * DPI),
  GUTTER_PIXELS: Math.round(GUTTER_INCHES * DPI),
} as const;

// Helper function to get layout config
export function getSheetLayout(sheetSize: SheetSize) {
  return STICKER_SHEET_LAYOUTS[sheetSize];
}

// Helper function to get specific option
export function getStickerOption(
  sheetSize: SheetSize,
  stickerCount: number
): StickerCountOption | undefined {
  const layout = STICKER_SHEET_LAYOUTS[sheetSize];
  return layout.options.find(opt => opt.count === stickerCount);
}

// Helper function to calculate grid dimensions for rendering
export function calculateGridDimensions(
  sheetSize: SheetSize,
  stickerCount: number,
  canvasSize: number
) {
  const layout = getSheetLayout(sheetSize);
  const option = getStickerOption(sheetSize, stickerCount);
  
  if (!option) {
    throw new Error(`Invalid sticker count ${stickerCount} for sheet size ${sheetSize}`);
  }
  
  const [cols, rows] = option.grid;
  const scale = canvasSize / layout.sheetSizePixels;
  
  const stickerSizeCanvas = Math.round(option.stickerSizePixels * scale);
  const gutterCanvas = Math.round(SHEET_CONSTANTS.GUTTER_PIXELS * scale);
  const marginCanvas = Math.round(SHEET_CONSTANTS.OUTER_MARGIN_PIXELS * scale);
  
  const usableWidth = canvasSize - 2 * marginCanvas;
  const usableHeight = canvasSize - 2 * marginCanvas;
  
  return {
    cols,
    rows,
    stickerSizeCanvas,
    gutterCanvas,
    marginCanvas,
    usableWidth,
    usableHeight,
    totalWidth: cols * stickerSizeCanvas + (cols - 1) * gutterCanvas,
    totalHeight: rows * stickerSizeCanvas + (rows - 1) * gutterCanvas,
  };
}
