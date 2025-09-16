import { Platform } from 'react-native';

/**
 * Fallback image processor for when the AI service is unavailable
 * Applies simple filters and transformations locally
 */

export type FallbackFilter = 
  | 'grayscale'
  | 'sepia'
  | 'invert'
  | 'brightness'
  | 'contrast'
  | 'blur'
  | 'vintage';

export async function applyFallbackFilter(
  base64Data: string,
  filter: FallbackFilter
): Promise<string> {
  // On web, we can use canvas for basic filters
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(base64Data); // Return original if canvas not supported
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        
        // Apply filters based on type
        switch (filter) {
          case 'grayscale':
            ctx.filter = 'grayscale(100%)';
            break;
          case 'sepia':
            ctx.filter = 'sepia(100%)';
            break;
          case 'invert':
            ctx.filter = 'invert(100%)';
            break;
          case 'brightness':
            ctx.filter = 'brightness(120%)';
            break;
          case 'contrast':
            ctx.filter = 'contrast(120%)';
            break;
          case 'blur':
            ctx.filter = 'blur(2px)';
            break;
          case 'vintage':
            ctx.filter = 'sepia(50%) contrast(90%) brightness(110%)';
            break;
        }
        
        ctx.drawImage(img, 0, 0);
        
        // Convert back to base64
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(base64Data);
              return;
            }
            
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1];
              resolve(base64);
            };
            reader.readAsDataURL(blob);
          },
          'image/png',
          0.9
        );
      };
      
      img.onerror = () => {
        console.warn('Failed to apply fallback filter, using original');
        resolve(base64Data);
      };
      
      img.src = `data:image/png;base64,${base64Data}`;
    });
  }
  
  // For native platforms, return original (would need native modules for filters)
  return base64Data;
}

/**
 * Check if fallback processing is available
 */
export function isFallbackAvailable(): boolean {
  if (Platform.OS === 'web') {
    return typeof document !== 'undefined' && 
           typeof Image !== 'undefined' && 
           !!document.createElement('canvas').getContext;
  }
  return false;
}

/**
 * Get available fallback filters with descriptions
 */
export function getAvailableFallbackFilters(): Array<{
  id: FallbackFilter;
  name: string;
  description: string;
}> {
  return [
    {
      id: 'grayscale',
      name: 'Black & White',
      description: 'Convert to grayscale'
    },
    {
      id: 'sepia',
      name: 'Sepia Tone',
      description: 'Apply warm vintage effect'
    },
    {
      id: 'vintage',
      name: 'Vintage',
      description: 'Retro photo effect'
    },
    {
      id: 'brightness',
      name: 'Brighten',
      description: 'Increase brightness'
    },
    {
      id: 'contrast',
      name: 'High Contrast',
      description: 'Enhance contrast'
    },
    {
      id: 'invert',
      name: 'Invert Colors',
      description: 'Negative effect'
    },
    {
      id: 'blur',
      name: 'Soft Blur',
      description: 'Apply gentle blur'
    }
  ];
}