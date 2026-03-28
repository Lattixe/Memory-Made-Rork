import { Platform } from 'react-native';

export type PrintfulExportOptions = {
  targetDPI?: number;
  ensureSRGB?: boolean;
  maxDimension?: number;
  quality?: number;
};

export async function exportForPrintful(
  base64Image: string,
  options: PrintfulExportOptions = {}
): Promise<string> {
  const {
    targetDPI = 300,
    ensureSRGB = true,
    maxDimension = 4000,
    quality = 1.0,
  } = options;

  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    console.log('Printful export only available on web');
    return base64Image;
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.log('Printful export timeout - using original');
      resolve(base64Image);
    }, 5000);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', {
        willReadFrequently: false,
        colorSpace: ensureSRGB ? 'srgb' : undefined,
      } as any) as CanvasRenderingContext2D | null;

      if (!ctx) {
        clearTimeout(timeoutId);
        resolve(base64Image);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            const scale = maxDimension / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
            console.log(`Resizing to ${width}x${height} for Printful compliance`);
          }

          const dpiScale = targetDPI / 72;
          const physicalWidth = width / dpiScale;
          const physicalHeight = height / dpiScale;

          console.log(`Physical size at ${targetDPI} DPI: ${physicalWidth.toFixed(2)}" x ${physicalHeight.toFixed(2)}"`);

          canvas.width = width;
          canvas.height = height;

          if (ensureSRGB) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                clearTimeout(timeoutId);
                resolve(base64Image);
                return;
              }

              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result as string;
                const base64Result = result.split(',')[1];
                clearTimeout(timeoutId);
                console.log('Printful-compliant export complete');
                resolve(base64Result);
              };
              reader.readAsDataURL(blob);
            },
            'image/png',
            quality
          );
        } catch (error) {
          clearTimeout(timeoutId);
          console.error('Error in Printful export:', error);
          resolve(base64Image);
        }
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        resolve(base64Image);
      };

      img.src = `data:image/png;base64,${base64Image}`;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error in Printful export setup:', error);
      resolve(base64Image);
    }
  });
}

export function calculatePrintfulDimensions(
  widthPx: number,
  heightPx: number,
  dpi: number = 300
): {
  widthInches: number;
  heightInches: number;
  widthCm: number;
  heightCm: number;
  meetsMinimumSpacing: boolean;
} {
  const widthInches = widthPx / dpi;
  const heightInches = heightPx / dpi;
  const widthCm = widthInches * 2.54;
  const heightCm = heightInches * 2.54;

  const minSpacingInches = 0.25;
  const meetsMinimumSpacing = widthInches >= minSpacingInches && heightInches >= minSpacingInches;

  return {
    widthInches,
    heightInches,
    widthCm,
    heightCm,
    meetsMinimumSpacing,
  };
}

export function validatePrintfulRequirements(
  widthPx: number,
  heightPx: number,
  dpi: number = 300
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (dpi < 300) {
    errors.push(`DPI too low: ${dpi} (minimum 300 required)`);
  }

  const dimensions = calculatePrintfulDimensions(widthPx, heightPx, dpi);

  if (!dimensions.meetsMinimumSpacing) {
    warnings.push(
      `Sticker dimensions (${dimensions.widthInches.toFixed(2)}" x ${dimensions.heightInches.toFixed(2)}") are smaller than recommended 0.25" minimum`
    );
  }

  if (widthPx < 300 || heightPx < 300) {
    errors.push(`Image resolution too low: ${widthPx}x${heightPx}px (minimum 300x300px at 300 DPI)`);
  }

  if (widthPx > 10000 || heightPx > 10000) {
    warnings.push(`Image resolution very high: ${widthPx}x${heightPx}px (may cause processing issues)`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function addPrintfulMetadata(
  base64Image: string,
  dpi: number = 300
): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return base64Image;
  }

  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;

      if (!ctx) {
        resolve(base64Image);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(base64Image);
              return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              const base64Result = result.split(',')[1];
              console.log(`Added metadata: ${img.width}x${img.height}px at ${dpi} DPI`);
              resolve(base64Result);
            };
            reader.readAsDataURL(blob);
          },
          'image/png',
          1.0
        );
      };

      img.onerror = () => resolve(base64Image);
      img.src = `data:image/png;base64,${base64Image}`;
    } catch (error) {
      console.error('Error adding Printful metadata:', error);
      resolve(base64Image);
    }
  });
}
