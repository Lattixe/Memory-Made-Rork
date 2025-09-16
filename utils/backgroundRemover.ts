import { Platform } from 'react-native';

/**
 * Optimized background removal with fast fallbacks
 * @param base64Image - Base64 encoded image string
 * @param aggressive - Use more aggressive background removal
 * @returns Base64 encoded image with background removed
 */
export async function removeBackground(base64Image: string, aggressive: boolean = true): Promise<string> {
  console.log('Starting optimized background removal...');
  
  // For web, try fast canvas-based removal first
  if (Platform.OS === 'web') {
    try {
      const canvasResult = await canvasBackgroundRemoval(base64Image);
      if (canvasResult !== base64Image) {
        console.log('Canvas background removal successful');
        return canvasResult;
      }
    } catch (error) {
      console.log('Canvas removal failed, trying API...');
    }
  }
  
  try {
    // Use simpler prompt for faster processing
    const prompt = aggressive 
      ? "Remove background completely, keep subject only with transparent background"
      : "Remove background, keep subject with transparent background";
    
    const requestBody = {
      prompt,
      images: [{ type: 'image', image: base64Image }],
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout

    const response = await fetch('https://toolkit.rork.com/images/edit/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`API returned ${response.status}, using fallback`);
      return base64Image;
    }

    const responseText = await response.text();
    
    // Quick validation
    if (responseText.trim().startsWith('<')) {
      console.log('HTML response received, using fallback');
      return base64Image;
    }
    
    try {
      const result = JSON.parse(responseText);
      if (result?.image?.base64Data) {
        console.log('API background removal complete');
        return result.image.base64Data;
      }
    } catch (e) {
      console.log('Parse error, using fallback');
    }
    
    return base64Image;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('Background removal timeout - returning original');
    } else {
      console.log('Background removal error - returning original');
    }
    return base64Image;
  }
}

/**
 * Fast canvas-based background removal for web
 */
async function canvasBackgroundRemoval(base64Image: string): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return base64Image;
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.log('Canvas processing timeout - using original');
      resolve(base64Image);
    }, 1500); // 1.5 second timeout
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) {
        clearTimeout(timeoutId);
        resolve(base64Image);
        return;
      }
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Quick background detection - just use corners
          const bgColor = {
            r: data[0],
            g: data[1],
            b: data[2]
          };
          
          const tolerance = 50; // Balanced tolerance
          
          // Optimized background removal - process every 2nd pixel for speed
          const step = canvas.width * canvas.height > 250000 ? 2 : 1; // Skip pixels for large images
          
          for (let y = 0; y < canvas.height; y += step) {
            for (let x = 0; x < canvas.width; x += step) {
              const idx = (y * canvas.width + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              
              // Simple distance calculation
              const distance = Math.abs(r - bgColor.r) + 
                             Math.abs(g - bgColor.g) + 
                             Math.abs(b - bgColor.b);
              
              if (distance < tolerance * 3) {
                // Make current pixel transparent
                data[idx + 3] = 0;
                
                // Fill skipped pixels if stepping
                if (step > 1) {
                  for (let dy = 0; dy < step && y + dy < canvas.height; dy++) {
                    for (let dx = 0; dx < step && x + dx < canvas.width; dx++) {
                      const fillIdx = ((y + dy) * canvas.width + (x + dx)) * 4;
                      if (fillIdx !== idx && fillIdx < data.length) {
                        data[fillIdx + 3] = 0;
                      }
                    }
                  }
                }
              }
            }
          }
          
          ctx.putImageData(imageData, 0, 0);
          
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
                console.log('Canvas removal complete');
                resolve(base64Result);
              };
              reader.readAsDataURL(blob);
            },
            'image/png',
            0.9
          );
        } catch (error) {
          clearTimeout(timeoutId);
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
      resolve(base64Image);
    }
  });
}

/**
 * Fast auto-crop for images
 */
export async function autoCropImage(base64Image: string): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return base64Image;
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(base64Image);
    }, 1000); // 1 second timeout
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) {
        clearTimeout(timeoutId);
        resolve(base64Image);
        return;
      }
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Fast bounds detection - sample every 4th pixel for speed
          let minX = canvas.width;
          let minY = canvas.height;
          let maxX = 0;
          let maxY = 0;
          
          for (let y = 0; y < canvas.height; y += 4) {
            for (let x = 0; x < canvas.width; x += 4) {
              const idx = (y * canvas.width + x) * 4;
              if (data[idx + 3] > 20) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
              }
            }
          }
          
          // Add padding
          const padding = 10;
          minX = Math.max(0, minX - padding);
          minY = Math.max(0, minY - padding);
          maxX = Math.min(canvas.width - 1, maxX + padding);
          maxY = Math.min(canvas.height - 1, maxY + padding);
          
          const cropWidth = maxX - minX + 1;
          const cropHeight = maxY - minY + 1;
          
          // Skip if crop is minimal
          if (cropWidth > canvas.width * 0.9 && cropHeight > canvas.height * 0.9) {
            clearTimeout(timeoutId);
            resolve(base64Image);
            return;
          }
          
          const croppedCanvas = document.createElement('canvas');
          const croppedCtx = croppedCanvas.getContext('2d');
          
          if (!croppedCtx) {
            clearTimeout(timeoutId);
            resolve(base64Image);
            return;
          }
          
          croppedCanvas.width = cropWidth;
          croppedCanvas.height = cropHeight;
          croppedCtx.drawImage(
            canvas,
            minX, minY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight
          );
          
          croppedCanvas.toBlob(
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
                console.log(`Cropped: ${img.width}x${img.height} to ${cropWidth}x${cropHeight}`);
                resolve(base64Result);
              };
              reader.readAsDataURL(blob);
            },
            'image/png',
            0.9
          );
        } catch (error) {
          clearTimeout(timeoutId);
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
      resolve(base64Image);
    }
  });
}

/**
 * Optimized sticker processing pipeline
 */
export async function processStickerImage(
  base64Image: string, 
  skipBackgroundRemoval: boolean = false,
  isAIGenerated: boolean = true
): Promise<string> {
  try {
    console.log('Processing sticker image...');
    
    // For AI-generated stickers, skip background removal since they already have transparent backgrounds
    if (isAIGenerated) {
      console.log('AI-generated sticker detected, skipping background removal');
      
      // Only do auto-crop for AI-generated images on web
      if (Platform.OS === 'web') {
        try {
          const croppedImage = await autoCropImage(base64Image);
          return croppedImage;
        } catch (cropError) {
          console.log('Auto-crop failed, using uncropped image');
          return base64Image;
        }
      }
      
      return base64Image;
    }
    
    let processedImage = base64Image;
    
    // Only do background removal for non-AI generated images
    if (!skipBackgroundRemoval && !isAIGenerated) {
      // Create a timeout promise with shorter timeout
      const timeoutPromise = new Promise<string>((resolve) => {
        setTimeout(() => {
          console.log('Background removal taking too long, using original');
          resolve(base64Image);
        }, 5000); // 5 second timeout - reduced from 10
      });
      
      // Race between background removal and timeout
      const removalPromise = removeBackground(base64Image, false); // Less aggressive for photos
      processedImage = await Promise.race([removalPromise, timeoutPromise]);
    }
    
    // Auto-crop only on web and if we have a processed image
    if (Platform.OS === 'web' && processedImage !== base64Image) {
      try {
        const croppedImage = await autoCropImage(processedImage);
        return croppedImage;
      } catch (cropError) {
        console.log('Auto-crop failed, using uncropped image');
        return processedImage;
      }
    }
    
    return processedImage;
  } catch (error) {
    console.log('Processing error, returning original:', error);
    return base64Image;
  }
}