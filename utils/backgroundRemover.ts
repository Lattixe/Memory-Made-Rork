import { Platform } from 'react-native';

export async function removeBackground(base64Image: string, aggressive: boolean = true): Promise<string> {
  console.log('Starting optimized background removal...');

  try {
    const baseUrl = (process.env.EXPO_PUBLIC_RORK_API_BASE_URL && typeof process.env.EXPO_PUBLIC_RORK_API_BASE_URL === 'string')
      ? process.env.EXPO_PUBLIC_RORK_API_BASE_URL
      : (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');

    if (baseUrl) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`${baseUrl}/api/rmbg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Image }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json() as { base64?: string };
        if (json?.base64 && typeof json.base64 === 'string') {
          console.log('Replicate background removal complete');
          return json.base64;
        }
      } else {
        console.log('Replicate proxy responded with', res.status);
      }
    } else {
      console.log('No base URL for backend; skipping Replicate proxy');
    }
  } catch (e) {
    console.log('Replicate proxy failed, falling back:', e);
  }

  if (Platform.OS === 'web') {
    try {
      const canvasResult = await canvasBackgroundRemoval(base64Image);
      if (canvasResult !== base64Image) {
        console.log('Canvas background removal successful');
        return canvasResult;
      }
    } catch (error) {
      console.log('Canvas removal failed, trying final fallback...');
    }
  }

  return base64Image;
}

async function canvasBackgroundRemoval(base64Image: string): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return base64Image;
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.log('Canvas processing timeout - using original');
      resolve(base64Image);
    }, 1500);
    
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
          
          const bgColor = {
            r: data[0],
            g: data[1],
            b: data[2]
          };
          
          const tolerance = 50;
          
          const step = canvas.width * canvas.height > 250000 ? 2 : 1;
          
          for (let y = 0; y < canvas.height; y += step) {
            for (let x = 0; x < canvas.width; x += step) {
              const idx = (y * canvas.width + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              
              const distance = Math.abs(r - bgColor.r) + 
                             Math.abs(g - bgColor.g) + 
                             Math.abs(b - bgColor.b);
              
              if (distance < tolerance * 3) {
                data[idx + 3] = 0;
                
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
            1.0
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

export async function autoCropImage(base64Image: string): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return base64Image;
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(base64Image);
    }, 1000);
    
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
          
          const padding = 10;
          minX = Math.max(0, minX - padding);
          minY = Math.max(0, minY - padding);
          maxX = Math.min(canvas.width - 1, maxX + padding);
          maxY = Math.min(canvas.height - 1, maxY + padding);
          
          const cropWidth = maxX - minX + 1;
          const cropHeight = maxY - minY + 1;
          
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
            1.0
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

type PostProcessOptions = {
  alphaThreshold?: number;
  fringeErode?: number;
  despeckleSize?: number;
  matteRGB?: { r: number; g: number; b: number } | null;
};

async function defringeAndDespeckle(base64Image: string, options?: PostProcessOptions): Promise<string> {
  const opts: Required<PostProcessOptions> = {
    alphaThreshold: options?.alphaThreshold ?? 5,
    fringeErode: options?.fringeErode ?? 2,
    despeckleSize: options?.despeckleSize ?? 3,
    matteRGB: options?.matteRGB ?? null,
  } as Required<PostProcessOptions>;

  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return base64Image;
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(base64Image);
    }, 1500);

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

          for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (a < opts.alphaThreshold) {
              data[i + 3] = 0;
              continue;
            }
            if (a < 128 && r > 235 && g > 235 && b > 235) {
              data[i + 3] = 0;
            }
            if (a > 0 && a < 255) {
              const brightness = (r + g + b) / 3;
              if (brightness > 240) {
                const alphaFactor = a / 255;
                data[i] = Math.round(r * alphaFactor);
                data[i + 1] = Math.round(g * alphaFactor);
                data[i + 2] = Math.round(b * alphaFactor);
              }
            }
          }

          if (opts.fringeErode > 0) {
            for (let iter = 0; iter < opts.fringeErode; iter++) {
              const copy = new Uint8ClampedArray(data);
              const w = canvas.width;
              const h = canvas.height;
              for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                  const idx = (y * w + x) * 4 + 3;
                  if (copy[idx] === 0) continue;
                  let transparentNeighbors = 0;
                  for (let ny = -1; ny <= 1; ny++) {
                    for (let nx = -1; nx <= 1; nx++) {
                      if (nx === 0 && ny === 0) continue;
                      const nIdx = ((y + ny) * w + (x + nx)) * 4 + 3;
                      if (copy[nIdx] < 20) transparentNeighbors++;
                    }
                  }
                  if (transparentNeighbors >= 5) {
                    data[idx] = 0;
                  }
                }
              }
            }
          }

          if (opts.despeckleSize > 0) {
            const copy = new Uint8ClampedArray(data);
            const w = canvas.width;
            const h = canvas.height;
            for (let y = 1; y < h - 1; y++) {
              for (let x = 1; x < w - 1; x++) {
                const aIdx = (y * w + x) * 4 + 3;
                if (copy[aIdx] === 0) continue;
                let count = 0;
                for (let ny = -1; ny <= 1; ny++) {
                  for (let nx = -1; nx <= 1; nx++) {
                    const nIdx = ((y + ny) * w + (x + nx)) * 4 + 3;
                    if (copy[nIdx] > 0) count++;
                  }
                }
                if (count <= opts.despeckleSize) {
                  data[aIdx] = 0;
                }
              }
            }
          }

          if (opts.matteRGB) {
            const mr = opts.matteRGB.r;
            const mg = opts.matteRGB.g;
            const mb = opts.matteRGB.b;
            for (let i = 0; i < data.length; i += 4) {
              const a = data[i + 3];
              if (a === 0 || a === 255) continue;
              const alpha = a / 255;
              data[i] = Math.round(data[i] * alpha + mr * (1 - alpha));
              data[i + 1] = Math.round(data[i + 1] * alpha + mg * (1 - alpha));
              data[i + 2] = Math.round(data[i + 2] * alpha + mb * (1 - alpha));
            }
          }

          ctx.putImageData(imageData, 0, 0);
          canvas.toBlob((blob) => {
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
              console.log('Defringe/despeckle complete');
              resolve(base64Result);
            };
            reader.readAsDataURL(blob);
          }, 'image/png', 1.0);
        } catch (e) {
          clearTimeout(timeoutId);
          resolve(base64Image);
        }
      };
      img.onerror = () => {
        clearTimeout(timeoutId);
        resolve(base64Image);
      };
      img.src = `data:image/png;base64,${base64Image}`;
    } catch (e) {
      clearTimeout(timeoutId);
      resolve(base64Image);
    }
  });
}

function floodFill(alphaMap: Uint8Array, w: number, h: number, startX: number, startY: number, visited: Uint8Array): number {
  const stack: Array<[number, number]> = [[startX, startY]];
  let count = 0;
  
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const idx = y * w + x;
    
    if (x < 0 || x >= w || y < 0 || y >= h) continue;
    if (visited[idx] === 1) continue;
    if (alphaMap[idx] < 10) continue;
    
    visited[idx] = 1;
    count++;
    
    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }
  
  return count;
}

function keepLargestComponent(alphaMap: Uint8Array, w: number, h: number): Uint8Array {
  const visited = new Uint8Array(w * h);
  const components: Array<{ startX: number; startY: number; size: number }> = [];
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (alphaMap[idx] >= 10 && visited[idx] === 0) {
        const size = floodFill(alphaMap, w, h, x, y, visited);
        components.push({ startX: x, startY: y, size });
      }
    }
  }
  
  if (components.length === 0) return alphaMap;
  
  components.sort((a, b) => b.size - a.size);
  const largest = components[0];
  
  const mask = new Uint8Array(w * h);
  floodFill(alphaMap, w, h, largest.startX, largest.startY, mask);
  
  const cleaned = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (mask[i] === 1) {
      cleaned[i] = alphaMap[i];
    }
  }
  
  return cleaned;
}

export async function addStrokeToImage(base64Image: string, strokeWidth: number = 3, strokeColor: string = '#FFFFFF'): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return base64Image;
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.log('Stroke addition timeout - using original');
      resolve(base64Image);
    }, 3000);
    
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
          
          const w = canvas.width;
          const h = canvas.height;
          
          console.log('Step 1: Extract alpha with soft threshold...');
          const alphaMap = new Uint8Array(w * h);
          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            alphaMap[i / 4] = alpha >= 10 ? alpha : 0;
          }
          
          console.log('Step 2: Keep only largest connected component...');
          const cleanedAlpha = keepLargestComponent(alphaMap, w, h);
          
          console.log('Step 3: Dilate to create stroke outline...');
          const dilatedAlpha = new Uint8Array(w * h);
          dilatedAlpha.set(cleanedAlpha);
          
          for (let iter = 0; iter < strokeWidth; iter++) {
            const source = new Uint8Array(dilatedAlpha);
            
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                const idx = y * w + x;
                let maxAlpha = source[idx];
                
                for (let dy = -1; dy <= 1; dy++) {
                  for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                      const nIdx = ny * w + nx;
                      maxAlpha = Math.max(maxAlpha, source[nIdx]);
                    }
                  }
                }
                
                dilatedAlpha[idx] = maxAlpha;
              }
            }
          }
          
          console.log('Step 4: Apply multi-pass Gaussian blur for ultra-smooth edges...');
          let blurredStroke = new Uint8Array(dilatedAlpha);
          const blurRadius = 3;
          const blurPasses = 3;
          
          for (let pass = 0; pass < blurPasses; pass++) {
            const source = new Uint8Array(blurredStroke);
            
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                const idx = y * w + x;
                
                if (cleanedAlpha[idx] > 128) {
                  continue;
                }
                
                let sum = 0;
                let weightSum = 0;
                
                for (let dy = -blurRadius; dy <= blurRadius; dy++) {
                  for (let dx = -blurRadius; dx <= blurRadius; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                      const nIdx = ny * w + nx;
                      const distance = Math.sqrt(dx * dx + dy * dy);
                      const weight = Math.exp(-(distance * distance) / (2 * (blurRadius / 1.5) * (blurRadius / 1.5)));
                      sum += source[nIdx] * weight;
                      weightSum += weight;
                    }
                  }
                }
                
                blurredStroke[idx] = Math.round(sum / weightSum);
              }
            }
          }
          
          console.log('Step 5: Apply final anti-aliasing pass...');
          const finalAlpha = new Uint8Array(w * h);
          const aaRadius = 1;
          
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = y * w + x;
              
              if (cleanedAlpha[idx] > 128) {
                finalAlpha[idx] = cleanedAlpha[idx];
              } else if (blurredStroke[idx] > 0) {
                let sum = 0;
                let count = 0;
                
                for (let dy = -aaRadius; dy <= aaRadius; dy++) {
                  for (let dx = -aaRadius; dx <= aaRadius; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                      const nIdx = ny * w + nx;
                      sum += blurredStroke[nIdx];
                      count++;
                    }
                  }
                }
                
                finalAlpha[idx] = Math.round(sum / count);
              }
            }
          }
          
          console.log('Step 6: Composite final image with smooth edges...');
          const r = parseInt(strokeColor.slice(1, 3), 16);
          const g = parseInt(strokeColor.slice(3, 5), 16);
          const b = parseInt(strokeColor.slice(5, 7), 16);
          
          const strokeData = ctx.createImageData(w, h);
          const strokePixels = strokeData.data;
          
          for (let i = 0; i < w * h; i++) {
            const originalAlpha = cleanedAlpha[i];
            const strokeAlpha = finalAlpha[i];
            
            const idx = i * 4;
            
            if (originalAlpha > 10) {
              strokePixels[idx] = data[idx];
              strokePixels[idx + 1] = data[idx + 1];
              strokePixels[idx + 2] = data[idx + 2];
              strokePixels[idx + 3] = originalAlpha;
            } else if (strokeAlpha > 10 && originalAlpha === 0) {
              strokePixels[idx] = r;
              strokePixels[idx + 1] = g;
              strokePixels[idx + 2] = b;
              strokePixels[idx + 3] = strokeAlpha;
            }
          }
          
          ctx.clearRect(0, 0, w, h);
          ctx.putImageData(strokeData, 0, 0);
          
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
                console.log('Clean print-ready stroke complete');
                resolve(base64Result);
              };
              reader.readAsDataURL(blob);
            },
            'image/png',
            1.0
          );
        } catch (error) {
          clearTimeout(timeoutId);
          console.error('Error adding stroke:', error);
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
      console.error('Error in stroke addition:', error);
      resolve(base64Image);
    }
  });
}

export async function processStickerImage(
  base64Image: string,
  skipBackgroundRemoval: boolean = false,
  isAIGenerated: boolean = true,
  addStroke: boolean = true
): Promise<string> {
  try {
    console.log('Processing sticker image...');

    let processedImage = base64Image;

    if (!skipBackgroundRemoval) {
      const timeoutPromise = new Promise<string>((resolve) => {
        setTimeout(() => {
          console.log('Background removal taking too long, using original');
          resolve(base64Image);
        }, 20000);
      });
      const removalPromise = removeBackground(base64Image, !isAIGenerated);
      processedImage = await Promise.race([removalPromise, timeoutPromise]);
    }

    // Add stroke to preserve cut line after background removal
    if (addStroke && Platform.OS === 'web') {
      try {
        console.log('Adding white stroke to preserve cut line...');
        processedImage = await addStrokeToImage(processedImage, 3, '#FFFFFF');
      } catch (strokeError) {
        console.log('Stroke addition failed, continuing without stroke');
      }
    }

    if (Platform.OS === 'web') {
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