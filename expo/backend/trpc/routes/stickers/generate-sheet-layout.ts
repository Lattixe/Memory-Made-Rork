import { z } from 'zod';
import { publicProcedure } from '../../create-context';

const sheetSizeSchema = z.enum(['3x3', '4x4', '5.5x5.5']);

const generateSheetLayoutInputSchema = z.object({
  stickerImageBase64: z.string(),
  sheetSize: sheetSizeSchema,
  cellSizeInches: z.number().default(0.25),
  outerMarginInches: z.number().default(0.125),
  cellGapInches: z.number().default(0.25),
  bleedInches: z.number().default(0.0),
  whiteBorderInches: z.number().default(0.0),
  dpi: z.number().default(300),
});

type SheetConfig = {
  sheetInches: [number, number];
  sheetPixels: [number, number];
  cellsPerSide: number;
  totalMinis: number;
  cellPixels: number;
  gapPixels: number;
  outerMarginPx: number;
};

type Placement = {
  row: number;
  col: number;
  cellX: number;
  cellY: number;
  cellW: number;
  cellH: number;
  artBboxPx: [number, number, number, number];
  cutlinePathSvg: string;
};

type SheetManifest = {
  dpi: number;
  units: string;
  sheets: {
    sheetName: string;
    sheetInches: [number, number];
    sheetPixels: [number, number];
    paramsIn: {
      outerMarginIn: number;
      cellGapIn: number;
      desiredCellSizeIn: number;
      bleedIn: number;
      whiteBorderIn: number;
    };
    cellsPerSide: number;
    totalMinis: number;
    cellPixels: number;
    gapPixels: number;
    outerMarginPx: number;
    placements: Placement[];
  }[];
  sourceImageInfo: {
    originalW: number;
    originalH: number;
    backgroundRemoved: boolean;
  };
};

function getSheetDimensions(size: string): [number, number] {
  switch (size) {
    case '3x3':
      return [3.0, 3.0];
    case '4x4':
      return [4.0, 4.0];
    case '5.5x5.5':
      return [5.5, 5.5];
    default:
      return [4.0, 4.0];
  }
}

function calculateSheetConfig(
  sheetInches: [number, number],
  cellSizeIn: number,
  outerMarginIn: number,
  cellGapIn: number,
  dpi: number
): SheetConfig {
  const [widthIn, heightIn] = sheetInches;
  const sheetPixels: [number, number] = [widthIn * dpi, heightIn * dpi];
  
  const usableSideIn = widthIn - 2 * outerMarginIn;
  const cellsPerSide = Math.floor((usableSideIn + cellGapIn) / (cellSizeIn + cellGapIn));
  
  const totalMinis = cellsPerSide * cellsPerSide;
  const cellPixels = Math.round(cellSizeIn * dpi);
  const gapPixels = Math.round(cellGapIn * dpi);
  const outerMarginPx = Math.round(outerMarginIn * dpi);
  
  return {
    sheetInches,
    sheetPixels,
    cellsPerSide,
    totalMinis,
    cellPixels,
    gapPixels,
    outerMarginPx,
  };
}

function generateCutlinePath(
  x: number,
  y: number,
  width: number,
  height: number,
  borderOffset: number
): string {
  const radius = Math.min(width, height) * 0.1;
  const x1 = x - borderOffset;
  const y1 = y - borderOffset;
  const w = width + 2 * borderOffset;
  const h = height + 2 * borderOffset;
  
  return `M ${x1 + radius} ${y1} ` +
    `L ${x1 + w - radius} ${y1} ` +
    `Q ${x1 + w} ${y1} ${x1 + w} ${y1 + radius} ` +
    `L ${x1 + w} ${y1 + h - radius} ` +
    `Q ${x1 + w} ${y1 + h} ${x1 + w - radius} ${y1 + h} ` +
    `L ${x1 + radius} ${y1 + h} ` +
    `Q ${x1} ${y1 + h} ${x1} ${y1 + h - radius} ` +
    `L ${x1} ${y1 + radius} ` +
    `Q ${x1} ${y1} ${x1 + radius} ${y1} Z`;
}

export const generateSheetLayoutProcedure = publicProcedure
  .input(generateSheetLayoutInputSchema)
  .mutation(async ({ input }) => {
    const {
      stickerImageBase64,
      sheetSize,
      cellSizeInches,
      outerMarginInches,
      cellGapInches,
      bleedInches,
      whiteBorderInches,
      dpi,
    } = input;

    const sheetInches = getSheetDimensions(sheetSize);
    const config = calculateSheetConfig(
      sheetInches,
      cellSizeInches,
      outerMarginInches,
      cellGapInches,
      dpi
    );

    const placements: Placement[] = [];
    const artSizePixels = Math.round((cellSizeInches - 2 * whiteBorderInches) * dpi);
    const artOffsetPixels = Math.round(whiteBorderInches * dpi);
    const borderOffsetPixels = Math.round((whiteBorderInches + bleedInches) * dpi);

    for (let row = 0; row < config.cellsPerSide; row++) {
      for (let col = 0; col < config.cellsPerSide; col++) {
        const cellX = config.outerMarginPx + col * (config.cellPixels + config.gapPixels);
        const cellY = config.outerMarginPx + row * (config.cellPixels + config.gapPixels);
        
        const artX = cellX + artOffsetPixels;
        const artY = cellY + artOffsetPixels;
        
        const cutlinePath = generateCutlinePath(
          cellX,
          cellY,
          config.cellPixels,
          config.cellPixels,
          borderOffsetPixels
        );

        placements.push({
          row,
          col,
          cellX,
          cellY,
          cellW: config.cellPixels,
          cellH: config.cellPixels,
          artBboxPx: [artX, artY, artSizePixels, artSizePixels],
          cutlinePathSvg: cutlinePath,
        });
      }
    }

    const manifest: SheetManifest = {
      dpi,
      units: 'px',
      sheets: [
        {
          sheetName: sheetSize,
          sheetInches: config.sheetInches,
          sheetPixels: config.sheetPixels,
          paramsIn: {
            outerMarginIn: outerMarginInches,
            cellGapIn: cellGapInches,
            desiredCellSizeIn: cellSizeInches,
            bleedIn: bleedInches,
            whiteBorderIn: whiteBorderInches,
          },
          cellsPerSide: config.cellsPerSide,
          totalMinis: config.totalMinis,
          cellPixels: config.cellPixels,
          gapPixels: config.gapPixels,
          outerMarginPx: config.outerMarginPx,
          placements,
        },
      ],
      sourceImageInfo: {
        originalW: 0,
        originalH: 0,
        backgroundRemoved: true,
      },
    };

    const svgCutlines = generateSVGCutlines(config, placements);

    return {
      manifest,
      svgCutlines,
      printImageBase64: stickerImageBase64,
    };
  });

function generateSVGCutlines(config: SheetConfig, placements: Placement[]): string {
  const [width, height] = config.sheetPixels;
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;
  svg += `  <g id="cutlines" fill="none" stroke="#FF00FF" stroke-width="1">\n`;
  
  for (const placement of placements) {
    svg += `    <path d="${placement.cutlinePathSvg}" />\n`;
  }
  
  svg += `  </g>\n`;
  svg += `</svg>`;
  
  return svg;
}
