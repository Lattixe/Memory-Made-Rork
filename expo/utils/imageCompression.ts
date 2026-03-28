import { Platform } from 'react-native';

/**
 * Compresses a base64 image to reduce size before sending to API
 * This helps reduce server load and improve processing speed
 */
export async function compressBase64Image(
  base64Data: string,
  maxWidth: number = 1024,
  maxHeight: number = 1024,
  quality: number = 0.8
): Promise<string> {
  // On web, we can use canvas for compression
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

        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          
          if (width > height) {
            width = maxWidth;
            height = width / aspectRatio;
          } else {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(base64Data);
              return;
            }
            
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              // Extract just the base64 part
              const base64 = result.split(',')[1];
              resolve(base64);
            };
            reader.readAsDataURL(blob);
          },
          'image/png',
          quality
        );
      };
      
      img.onerror = () => {
        console.warn('Failed to compress image, using original');
        resolve(base64Data);
      };
      
      // Load the image
      img.src = `data:image/png;base64,${base64Data}`;
    });
  }
  
  // For native platforms, return as-is for now
  // In production, you'd use a native image compression library
  return base64Data;
}

/**
 * Estimates the size of a base64 string in MB
 */
export function estimateBase64Size(base64String: string): number {
  // Base64 encoding increases size by ~33%
  const sizeInBytes = (base64String.length * 3) / 4;
  const sizeInMB = sizeInBytes / (1024 * 1024);
  return sizeInMB;
}

/**
 * Checks if an image needs compression based on its size
 */
export function needsCompression(base64Data: string, maxSizeMB: number = 2): boolean {
  const estimatedSize = estimateBase64Size(base64Data);
  return estimatedSize > maxSizeMB;
}