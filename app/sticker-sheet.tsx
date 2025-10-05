import React, { useState, useRef, useCallback, memo, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  PanResponder,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, Trash2, RotateCcw, ShoppingCart, Grid3X3, Sparkles, Download } from 'lucide-react-native';
import { neutralColors } from '@/constants/colors';
import { router, useLocalSearchParams } from 'expo-router';
import { useUser, SavedSticker } from '@/contexts/UserContext';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import { STICKER_SHEET_LAYOUTS, calculateGridDimensions, SheetSize as LayoutSheetSize, SHEET_CONSTANTS } from '@/constants/stickerSheetLayouts';


const { width: screenWidth } = Dimensions.get('window');

type SheetSize = '3x3' | '4x4' | '5x5';

const CANVAS_SIZE = screenWidth - 48;
const CANVAS_ASPECT_RATIO = 1;
const CANVAS_HEIGHT = CANVAS_SIZE * CANVAS_ASPECT_RATIO;
const STICKER_OUTLINE_WIDTH = 2;

function getCanvasDimensions(sheetSize: SheetSize, stickerCount: number) {
  const gridDims = calculateGridDimensions(sheetSize as LayoutSheetSize, stickerCount, CANVAS_SIZE);
  
  return {
    STICKER_SIZE_PIXELS: gridDims.stickerSizeCanvas,
    MIN_SPACING_PIXELS: gridDims.gutterCanvas,
    SAFE_MARGIN_CANVAS: gridDims.marginCanvas,
    PRINTABLE_CANVAS_WIDTH: gridDims.usableWidth,
    PRINTABLE_CANVAS_HEIGHT: gridDims.usableHeight,
    MAX_STICKERS: stickerCount,
    COLS: gridDims.cols,
    ROWS: gridDims.rows,
  };
}

interface StickerPosition {
  id: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  width: number;
  height: number;
  sticker: SavedSticker;
  isOutOfBounds?: boolean;
  isColliding?: boolean;
}

const StickerSheetScreen = memo(() => {
  const { savedStickers } = useUser();
  const params = useLocalSearchParams();
  const paramSheetSize = typeof params.sheetSize === 'string' ? params.sheetSize as SheetSize : '4x4';
  const paramStickerCount = typeof params.stickerCount === 'string' ? parseInt(params.stickerCount, 10) : null;
  
  const [selectedStickers, setSelectedStickers] = useState<StickerPosition[]>([]);
  const [isProcessing] = useState<boolean>(false);
  const [draggedSticker, setDraggedSticker] = useState<string | null>(null);
  const [isGeneratingSheet, setIsGeneratingSheet] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<{ outOfBounds: string[]; colliding: string[] }>({ outOfBounds: [], colliding: [] });
  const [currentSheetSize] = useState<SheetSize>(paramSheetSize);
  const [currentStickerCount] = useState<number>(() => {
    const layout = STICKER_SHEET_LAYOUTS[paramSheetSize as LayoutSheetSize];
    return paramStickerCount ?? layout.defaultOption.count;
  });
  const animatedValues = useRef<{ [key: string]: { pan: Animated.ValueXY; scale: Animated.Value; opacity: Animated.Value; borderColor: Animated.Value } }>({});
  const panResponders = useRef<{ [key: string]: any }>({});
  const canvasRef = useRef<View>(null);
  const dragStartPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const scrollViewRef = useRef<ScrollView>(null);
  
  const canvasDims = useMemo(() => getCanvasDimensions(currentSheetSize, currentStickerCount), [currentSheetSize, currentStickerCount]);
  const { STICKER_SIZE_PIXELS, MIN_SPACING_PIXELS, SAFE_MARGIN_CANVAS, PRINTABLE_CANVAS_WIDTH, PRINTABLE_CANVAS_HEIGHT, MAX_STICKERS, COLS, ROWS } = canvasDims;

  const initializeAnimatedValues = useCallback((stickerId: string, x?: number, y?: number) => {
    if (!animatedValues.current[stickerId]) {
      animatedValues.current[stickerId] = {
        pan: new Animated.ValueXY({ x: x ?? 0, y: y ?? 0 }),
        scale: new Animated.Value(1),
        opacity: new Animated.Value(1),
        borderColor: new Animated.Value(0),
      };
    } else if (x !== undefined && y !== undefined) {
      animatedValues.current[stickerId].pan.setValue({ x, y });
    }
  }, []);

  const isWithinBounds = useCallback((x: number, y: number, w: number, h: number): boolean => {
    return (
      x >= SAFE_MARGIN_CANVAS &&
      x <= SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_WIDTH - w &&
      y >= SAFE_MARGIN_CANVAS &&
      y <= SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_HEIGHT - h
    );
  }, [SAFE_MARGIN_CANVAS, PRINTABLE_CANVAS_WIDTH, PRINTABLE_CANVAS_HEIGHT]);

  const checkCollision = useCallback((a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}): boolean => {
    const gap = MIN_SPACING_PIXELS;
    const noOverlap = (a.x + a.w + gap) <= b.x || (b.x + b.w + gap) <= a.x || (a.y + a.h + gap) <= b.y || (b.y + b.h + gap) <= a.y;
    return !noOverlap;
  }, [MIN_SPACING_PIXELS]);

  const findValidPosition = useCallback((targetX: number, targetY: number, currentId: string): { x: number; y: number; isValid: boolean } => {
    const me = selectedStickers.find(s => s.id === currentId);
    const myW = me?.width ?? STICKER_SIZE_PIXELS;
    const myH = me?.height ?? STICKER_SIZE_PIXELS;

    let x = Math.max(SAFE_MARGIN_CANVAS, Math.min(SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_WIDTH - myW, targetX));
    let y = Math.max(SAFE_MARGIN_CANVAS, Math.min(SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_HEIGHT - myH, targetY));
    
    const otherStickers = selectedStickers.filter(s => s.id !== currentId);
    
    for (const other of otherStickers) {
      if (checkCollision({x, y, w: myW, h: myH}, {x: other.x, y: other.y, w: other.width, h: other.height})) {
        const pushRight = other.x + other.width + MIN_SPACING_PIXELS;
        const pushDown = other.y + other.height + MIN_SPACING_PIXELS;
        x = Math.min(pushRight, SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_WIDTH - myW);
        y = Math.min(pushDown, SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_HEIGHT - myH);
      }
    }
    
    const isValid = isWithinBounds(x, y, myW, myH) && !otherStickers.some(other => checkCollision({x, y, w: myW, h: myH}, {x: other.x, y: other.y, w: other.width, h: other.height}));
    
    return { x, y, isValid };
  }, [selectedStickers, isWithinBounds, checkCollision, SAFE_MARGIN_CANVAS, PRINTABLE_CANVAS_WIDTH, PRINTABLE_CANVAS_HEIGHT, STICKER_SIZE_PIXELS, MIN_SPACING_PIXELS]);

  const validatePositions = useCallback(() => {
    const outOfBounds: string[] = [];
    const colliding: string[] = [];
    
    selectedStickers.forEach((sticker, index) => {
      if (!isWithinBounds(sticker.x, sticker.y, sticker.width, sticker.height)) {
        outOfBounds.push(sticker.id);
      }
      
      for (let j = index + 1; j < selectedStickers.length; j++) {
        const other = selectedStickers[j];
        if (checkCollision({x: sticker.x, y: sticker.y, w: sticker.width, h: sticker.height}, {x: other.x, y: other.y, w: other.width, h: other.height})) {
          if (!colliding.includes(sticker.id)) colliding.push(sticker.id);
          if (!colliding.includes(other.id)) colliding.push(other.id);
        }
      }
    });
    
    setValidationErrors({ outOfBounds, colliding });
    
    setSelectedStickers(prev => 
      prev.map(sticker => ({
        ...sticker,
        isOutOfBounds: outOfBounds.includes(sticker.id),
        isColliding: colliding.includes(sticker.id),
      }))
    );
    
    selectedStickers.forEach(sticker => {
      if (animatedValues.current[sticker.id]) {
        const isInvalid = outOfBounds.includes(sticker.id) || colliding.includes(sticker.id);
        Animated.timing(animatedValues.current[sticker.id].borderColor, {
          toValue: isInvalid ? 1 : 0,
          duration: 200,
          useNativeDriver: false,
        }).start();
      }
    });
  }, [selectedStickers, isWithinBounds, checkCollision]);

  const arrangeStickersNeatly = useCallback(() => {
    if (selectedStickers.length === 0) return;

    console.log('[Auto-Arrange] Starting with', selectedStickers.length, 'stickers');
    console.log('[Auto-Arrange] Sheet size:', currentSheetSize, 'Sticker count:', currentStickerCount);
    console.log('[Auto-Arrange] Grid:', COLS, 'x', ROWS);
    console.log('[Auto-Arrange] Sticker size:', STICKER_SIZE_PIXELS, 'Gutter:', MIN_SPACING_PIXELS);
    console.log('[Auto-Arrange] Safe margin:', SAFE_MARGIN_CANVAS);
    console.log('[Auto-Arrange] Printable area:', PRINTABLE_CANVAS_WIDTH, 'x', PRINTABLE_CANVAS_HEIGHT);

    const totalGridWidth = COLS * STICKER_SIZE_PIXELS + (COLS - 1) * MIN_SPACING_PIXELS;
    const totalGridHeight = ROWS * STICKER_SIZE_PIXELS + (ROWS - 1) * MIN_SPACING_PIXELS;
    
    console.log('[Auto-Arrange] Total grid size:', totalGridWidth, 'x', totalGridHeight);
    
    const startX = SAFE_MARGIN_CANVAS + Math.max(0, (PRINTABLE_CANVAS_WIDTH - totalGridWidth) / 2);
    const startY = SAFE_MARGIN_CANVAS + Math.max(0, (PRINTABLE_CANVAS_HEIGHT - totalGridHeight) / 2);
    
    console.log('[Auto-Arrange] Start position:', startX, ',', startY);

    const newPositions = selectedStickers.slice(0, currentStickerCount).map((item, index) => {
      const row = Math.floor(index / COLS);
      const col = index % COLS;
      
      const slotX = startX + col * (STICKER_SIZE_PIXELS + MIN_SPACING_PIXELS);
      const slotY = startY + row * (STICKER_SIZE_PIXELS + MIN_SPACING_PIXELS);

      const w = item.width;
      const h = item.height;
      const x = slotX + Math.max(0, (STICKER_SIZE_PIXELS - w) / 2);
      const y = slotY + Math.max(0, (STICKER_SIZE_PIXELS - h) / 2);
      
      const maxX = SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_WIDTH - w;
      const maxY = SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_HEIGHT - h;
      
      const clampedX = Math.max(SAFE_MARGIN_CANVAS, Math.min(maxX, x));
      const clampedY = Math.max(SAFE_MARGIN_CANVAS, Math.min(maxY, y));
      
      console.log(`[Auto-Arrange] Sticker ${index}: (${col}, ${row}) -> (${clampedX}, ${clampedY})`);
      
      return {
        ...item,
        x: clampedX,
        y: clampedY,
        rotation: 0,
        isOutOfBounds: false,
        isColliding: false,
      };
    });
    
    console.log('[Auto-Arrange] Arranged', newPositions.length, 'stickers');
    
    setSelectedStickers(newPositions);
    setValidationErrors({ outOfBounds: [], colliding: [] });
    panResponders.current = {};
    animatedValues.current = {};
    
    setTimeout(() => {
      console.log('[Auto-Arrange] Running validation...');
      validatePositions();
    }, 100);
  }, [selectedStickers, currentSheetSize, currentStickerCount, STICKER_SIZE_PIXELS, MIN_SPACING_PIXELS, SAFE_MARGIN_CANVAS, PRINTABLE_CANVAS_WIDTH, PRINTABLE_CANVAS_HEIGHT, COLS, ROWS, validatePositions]);

  const createPanResponder = useCallback((stickerId: string, currentX: number, currentY: number) => {
    initializeAnimatedValues(stickerId, currentX, currentY);
    let startX = currentX;
    let startY = currentY;
    let initialTouchX = 0;
    let initialTouchY = 0;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        startX = currentX;
        startY = currentY;
        initialTouchX = evt.nativeEvent.locationX;
        initialTouchY = evt.nativeEvent.locationY;
        dragStartPosition.current = { x: currentX, y: currentY };
        setDraggedSticker(stickerId);
        
        if (animatedValues.current[stickerId]) {
          animatedValues.current[stickerId].pan.flattenOffset();
          animatedValues.current[stickerId].pan.setValue({ x: currentX, y: currentY });
          
          Animated.parallel([
            Animated.timing(animatedValues.current[stickerId].scale, {
              toValue: 1.15,
              duration: 100,
              useNativeDriver: false,
            }),
            Animated.timing(animatedValues.current[stickerId].opacity, {
              toValue: 0.8,
              duration: 100,
              useNativeDriver: false,
            }),
          ]).start();
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (animatedValues.current[stickerId]) {
          const me = selectedStickers.find(s => s.id === stickerId);
          const w = me?.width ?? STICKER_SIZE_PIXELS;
          const h = me?.height ?? STICKER_SIZE_PIXELS;
          const touchOffsetX = initialTouchX - (w / 2);
          const touchOffsetY = initialTouchY - (h / 2);
          const newX = startX + gestureState.dx - touchOffsetX;
          const newY = startY + gestureState.dy - touchOffsetY;
          
          animatedValues.current[stickerId].pan.setValue({ x: newX, y: newY });
          
          const inBounds = isWithinBounds(newX, newY, w, h);
          Animated.timing(animatedValues.current[stickerId].borderColor, {
            toValue: !inBounds ? 1 : 0,
            duration: 0,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setDraggedSticker(null);
        
        const me = selectedStickers.find(s => s.id === stickerId);
        const w = me?.width ?? STICKER_SIZE_PIXELS;
        const h = me?.height ?? STICKER_SIZE_PIXELS;
        const touchOffsetX = initialTouchX - (w / 2);
        const touchOffsetY = initialTouchY - (h / 2);
        const targetX = startX + gestureState.dx - touchOffsetX;
        const targetY = startY + gestureState.dy - touchOffsetY;
        
        const { x: finalX, y: finalY, isValid } = findValidPosition(targetX, targetY, stickerId);
        
        setSelectedStickers(prev => {
          const updated = prev.map(item => {
            if (item.id === stickerId) {
              delete panResponders.current[stickerId];
              return { 
                ...item, 
                x: finalX, 
                y: finalY,
                isOutOfBounds: !isWithinBounds(finalX, finalY, item.width, item.height),
                isColliding: false
              };
            }
            return item;
          });
          return updated;
        });
        
        if (animatedValues.current[stickerId]) {
          animatedValues.current[stickerId].pan.setValue({ x: finalX, y: finalY });
          
          Animated.parallel([
            Animated.timing(animatedValues.current[stickerId].scale, {
              toValue: 1,
              duration: 200,
              useNativeDriver: false,
            }),
            Animated.timing(animatedValues.current[stickerId].opacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: false,
            }),
            Animated.timing(animatedValues.current[stickerId].borderColor, {
              toValue: isValid ? 0 : 1,
              duration: 200,
              useNativeDriver: false,
            }),
          ]).start();
        }
        
        setTimeout(() => validatePositions(), 100);
      },
    });
  }, [initializeAnimatedValues, isWithinBounds, validatePositions, findValidPosition, STICKER_SIZE_PIXELS]);

  const computeStickerBox = (sticker: SavedSticker) => {
    const natW = sticker.imageWidth ?? STICKER_SIZE_PIXELS;
    const natH = sticker.imageHeight ?? STICKER_SIZE_PIXELS;
    if (natW <= 0 || natH <= 0) return { w: STICKER_SIZE_PIXELS, h: STICKER_SIZE_PIXELS };
    
    const ratio = natW / natH;
    let w = STICKER_SIZE_PIXELS;
    let h = STICKER_SIZE_PIXELS;
    
    if (ratio > 1) {
      w = STICKER_SIZE_PIXELS;
      h = Math.round(STICKER_SIZE_PIXELS / ratio);
    } else if (ratio < 1) {
      h = STICKER_SIZE_PIXELS;
      w = Math.round(STICKER_SIZE_PIXELS * ratio);
    }
    
    const minEdge = 24;
    w = Math.max(minEdge, w);
    h = Math.max(minEdge, h);
    
    console.log(`[computeStickerBox] Natural: ${natW}x${natH}, Ratio: ${ratio.toFixed(2)}, Computed: ${w}x${h}`);
    
    return { w, h };
  };

  const addStickerToSheet = useCallback((sticker: SavedSticker) => {
    if (selectedStickers.length >= MAX_STICKERS) {
      Alert.alert('Maximum Reached', `You can add up to ${MAX_STICKERS} stickers per sheet.`);
      return;
    }

    let x = 0;
    let y = 0;
    let positionFound = false;
    
    const targetCount = selectedStickers.length + 1;
    let cols = Math.min(COLS, targetCount);
    let rows = Math.ceil(targetCount / cols);
    
    const spacingX = STICKER_SIZE_PIXELS + MIN_SPACING_PIXELS + 10;
    const spacingY = STICKER_SIZE_PIXELS + MIN_SPACING_PIXELS + 10;
    
    const totalWidth = cols * STICKER_SIZE_PIXELS + (cols - 1) * (MIN_SPACING_PIXELS + 10);
    const totalHeight = rows * STICKER_SIZE_PIXELS + (rows - 1) * (MIN_SPACING_PIXELS + 10);
    
    const startX = SAFE_MARGIN_CANVAS + Math.max(0, Math.floor((PRINTABLE_CANVAS_WIDTH - totalWidth) / 2));
    const startY = SAFE_MARGIN_CANVAS + Math.max(0, Math.floor((PRINTABLE_CANVAS_HEIGHT - totalHeight) / 2));
    
    const gridPositions: { x: number; y: number }[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const gridX = startX + col * spacingX;
        const gridY = startY + row * spacingY;
        const box = computeStickerBox(sticker);
        if (isWithinBounds(gridX, gridY, box.w, box.h)) {
          gridPositions.push({ x: gridX, y: gridY });
        }
      }
    }
    
    for (const pos of gridPositions) {
      const { w, h } = computeStickerBox(sticker);
      const hasCollision = selectedStickers.some(existing => 
        checkCollision({x: pos.x, y: pos.y, w, h}, {x: existing.x, y: existing.y, w: existing.width, h: existing.height})
      );
      
      if (!hasCollision) {
        x = pos.x;
        y = pos.y;
        positionFound = true;
        break;
      }
    }
    
    if (!positionFound) {
      const step = 20;
      const scanBox = computeStickerBox(sticker);
      for (let testY = SAFE_MARGIN_CANVAS; testY <= SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_HEIGHT - scanBox.h && !positionFound; testY += step) {
        for (let testX = SAFE_MARGIN_CANVAS; testX <= SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_WIDTH - scanBox.w && !positionFound; testX += step) {
          const { w, h } = computeStickerBox(sticker);
          const hasCollision = selectedStickers.some(existing => 
            checkCollision({x: testX, y: testY, w, h}, {x: existing.x, y: existing.y, w: existing.width, h: existing.height})
          );
          
          if (!hasCollision) {
            x = testX;
            y = testY;
            positionFound = true;
          }
        }
      }
    }
    
    if (!positionFound) {
      const tempBox = computeStickerBox(sticker);
      const tempPosition: StickerPosition = {
        id: `${sticker.id}-${Date.now()}-${Math.random()}`,
        x: SAFE_MARGIN_CANVAS,
        y: SAFE_MARGIN_CANVAS,
        rotation: 0,
        scale: 1,
        width: tempBox.w,
        height: tempBox.h,
        sticker,
        isOutOfBounds: false,
        isColliding: true,
      };
      setSelectedStickers(prev => {
        const newList = [...prev, tempPosition];
        setTimeout(() => arrangeStickersNeatly(), 50);
        return newList;
      });
      return;
    }
    
    const box = computeStickerBox(sticker);
    const newPosition: StickerPosition = {
      id: `${sticker.id}-${Date.now()}-${Math.random()}`,
      x,
      y,
      rotation: 0,
      scale: 1,
      width: box.w,
      height: box.h,
      sticker,
      isOutOfBounds: false,
      isColliding: false,
    };
    
    setSelectedStickers(prev => [...prev, newPosition]);
    setTimeout(() => validatePositions(), 100);
  }, [selectedStickers, isWithinBounds, checkCollision, validatePositions, arrangeStickersNeatly, MAX_STICKERS, COLS, STICKER_SIZE_PIXELS, MIN_SPACING_PIXELS, SAFE_MARGIN_CANVAS, PRINTABLE_CANVAS_WIDTH, PRINTABLE_CANVAS_HEIGHT]);

  const removeStickerFromSheet = useCallback((positionId: string) => {
    setSelectedStickers(prev => {
      const updatedStickers = prev.filter(item => item.id !== positionId);
      delete panResponders.current[positionId];
      delete animatedValues.current[positionId];
      return updatedStickers;
    });
    setTimeout(() => validatePositions(), 100);
  }, [validatePositions]);

  const rotateSticker = useCallback((positionId: string) => {
    setSelectedStickers(prev => 
      prev.map(item => 
        item.id === positionId 
          ? { ...item, rotation: (item.rotation + 90) % 360 }
          : item
      )
    );
  }, []);

  const clearSheet = useCallback(() => {
    Alert.alert(
      'Clear Sheet',
      'Are you sure you want to remove all stickers from the sheet?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setSelectedStickers([]);
            animatedValues.current = {};
          },
        },
      ]
    );
  }, []);

  const generateStickerSheetWeb = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        reject(new Error('Document not available'));
        return;
      }

      const layout = STICKER_SHEET_LAYOUTS[currentSheetSize as LayoutSheetSize];
      const canvas = document.createElement('canvas');
      canvas.width = layout.sheetSizePixels;
      canvas.height = layout.sheetSizePixels;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let loadedImages = 0;
      const totalImages = selectedStickers.length;
      
      if (totalImages === 0) {
        resolve(canvas.toDataURL('image/png'));
        return;
      }

      const scaleX = layout.sheetSizePixels / CANVAS_SIZE;
      const scaleY = layout.sheetSizePixels / CANVAS_HEIGHT;
      
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(
        SHEET_CONSTANTS.OUTER_MARGIN_PIXELS,
        SHEET_CONSTANTS.OUTER_MARGIN_PIXELS,
        layout.sheetSizePixels - 2 * SHEET_CONSTANTS.OUTER_MARGIN_PIXELS,
        layout.sheetSizePixels - 2 * SHEET_CONSTANTS.OUTER_MARGIN_PIXELS
      );
      
      selectedStickers.forEach((stickerPos) => {
        const img = new (window as any).Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          const x = stickerPos.x * scaleX;
          const y = stickerPos.y * scaleY;
          const boxWidth = (stickerPos.width ?? STICKER_SIZE_PIXELS) * scaleX;
          const boxHeight = (stickerPos.height ?? STICKER_SIZE_PIXELS) * scaleY;

          const naturalW = img.naturalWidth ?? img.width;
          const naturalH = img.naturalHeight ?? img.height;
          
          if (naturalW <= 0 || naturalH <= 0) {
            console.error('[generateStickerSheetWeb] Invalid image dimensions:', naturalW, naturalH);
            loadedImages++;
            if (loadedImages === totalImages) {
              resolve(canvas.toDataURL('image/png'));
            }
            return;
          }
          
          const ratio = naturalW / naturalH;
          
          let drawW = boxWidth;
          let drawH = boxHeight;
          
          if (ratio > 1) {
            drawW = boxWidth;
            drawH = boxWidth / ratio;
            if (drawH > boxHeight) {
              drawH = boxHeight;
              drawW = boxHeight * ratio;
            }
          } else if (ratio < 1) {
            drawH = boxHeight;
            drawW = boxHeight * ratio;
            if (drawW > boxWidth) {
              drawW = boxWidth;
              drawH = boxWidth / ratio;
            }
          } else {
            const minDim = Math.min(boxWidth, boxHeight);
            drawW = minDim;
            drawH = minDim;
          }
          
          console.log(`[generateStickerSheetWeb] Sticker: ${stickerPos.id}, Natural: ${naturalW}x${naturalH}, Box: ${boxWidth.toFixed(0)}x${boxHeight.toFixed(0)}, Draw: ${drawW.toFixed(0)}x${drawH.toFixed(0)}`);
          
          ctx.save();
          ctx.translate(x + boxWidth / 2, y + boxHeight / 2);
          ctx.rotate((stickerPos.rotation * Math.PI) / 180);
          ctx.drawImage(
            img,
            -drawW / 2,
            -drawH / 2,
            drawW,
            drawH,
          );
          ctx.restore();
          
          loadedImages++;
          if (loadedImages === totalImages) {
            resolve(canvas.toDataURL('image/png'));
          }
        };
        
        img.onerror = () => {
          console.error('Failed to load sticker image:', stickerPos.sticker.stickerImage);
          loadedImages++;
          if (loadedImages === totalImages) {
            resolve(canvas.toDataURL('image/png'));
          }
        };
        
        img.src = stickerPos.sticker.stickerImage;
      });
    });
  }, [selectedStickers, currentSheetSize, STICKER_SIZE_PIXELS]);

  const generateStickerSheetMobile = useCallback(async (): Promise<string> => {
    if (!canvasRef.current) {
      throw new Error('Canvas reference not available');
    }

    try {
      const layout = STICKER_SHEET_LAYOUTS[currentSheetSize as LayoutSheetSize];
      const uri = await captureRef(canvasRef.current, {
        format: 'png',
        quality: 1.0,
        width: layout.sheetSizePixels,
        height: layout.sheetSizePixels,
      });

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return `data:image/png;base64,${base64}`;
    } catch (error) {
      console.error('Error capturing sticker sheet:', error);
      throw error;
    }
  }, [currentSheetSize]);

  const generateStickerSheetImage = useCallback(async (): Promise<string> => {
    try {
      if (Platform.OS === 'web') {
        return await generateStickerSheetWeb();
      } else {
        return await generateStickerSheetMobile();
      }
    } catch (error) {
      console.error('Error generating sticker sheet image:', error);
      throw error;
    }
  }, [generateStickerSheetWeb, generateStickerSheetMobile]);

  const proceedToCheckout = useCallback(async () => {
    if (selectedStickers.length === 0) {
      Alert.alert('No Stickers', 'Please add at least one sticker to the sheet.');
      return;
    }
    
    if (validationErrors.outOfBounds.length > 0 || validationErrors.colliding.length > 0) {
      Alert.alert(
        'Invalid Sticker Positions',
        'Some stickers are outside the safe area or overlapping. Please adjust their positions or use Auto Arrange.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Auto Arrange', 
            onPress: () => {
              arrangeStickersNeatly();
              setTimeout(() => proceedToCheckout(), 500);
            }
          },
        ]
      );
      return;
    }

    setIsGeneratingSheet(true);
    
    try {
      const stickerSheetImage = await generateStickerSheetImage();
      
      router.push({
        pathname: '/checkout',
        params: {
          originalImage: 'sticker-sheet',
          finalStickers: stickerSheetImage,
          isReorder: 'false',
          isStickerSheet: 'true',
          stickerCount: currentStickerCount.toString(),
          sheetSize: currentSheetSize,
          isMultiStickerSheet: 'false',
        },
      });
    } catch (error) {
      console.error('Error generating sticker sheet:', error);
      Alert.alert(
        'Generation Failed',
        'Failed to generate sticker sheet. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsGeneratingSheet(false);
    }
  }, [selectedStickers, validationErrors, arrangeStickersNeatly, generateStickerSheetImage, currentStickerCount, currentSheetSize]);

  useEffect(() => {
    selectedStickers.forEach((item) => {
      initializeAnimatedValues(item.id, item.x, item.y);
      if (!panResponders.current[item.id]) {
        panResponders.current[item.id] = createPanResponder(item.id, item.x, item.y);
      }
    });
  }, [selectedStickers, initializeAnimatedValues, createPanResponder]);

  if (savedStickers.length === 0) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={24} color={neutralColors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Create Sticker Sheet</Text>
            </View>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Saved Stickers</Text>
            <Text style={styles.emptySubtitle}>
              You need to create some memory stickers first before you can make a sticker sheet.
            </Text>
            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={() => router.push('/')}
            >
              <Text style={styles.createFirstButtonText}>Create Your First Sticker</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={neutralColors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Create Sticker Sheet</Text>
          </View>
          <TouchableOpacity style={styles.clearButton} onPress={clearSheet}>
            <Trash2 size={20} color={neutralColors.error} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          ref={scrollViewRef} 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          scrollEnabled={draggedSticker === null}
        >
          <View style={styles.content}>
            <View style={styles.canvasContainer}>
              <View style={styles.canvasTitleContainer}>
                <Text style={styles.canvasTitle}>
                  {STICKER_SHEET_LAYOUTS[currentSheetSize as LayoutSheetSize].displayName} Kiss-Cut Sheet
                </Text>
                <Text style={styles.canvasSubtitle}>
                  {selectedStickers.length}/{MAX_STICKERS} stickers • {COLS}×{ROWS} grid • Print-ready format
                </Text>
              </View>
              <View 
                ref={canvasRef}
                style={[styles.canvas, { height: CANVAS_HEIGHT }]}
                collapsable={false}
                testID="stickerSheetCanvas"
              >
                {selectedStickers.map((item) => {
                  const anim = animatedValues.current[item.id];
                  const panResponder = panResponders.current[item.id];

                  if (!anim) {
                    return null;
                  }

                  const borderColorInterpolation = anim.borderColor.interpolate({
                    inputRange: [0, 1],
                    outputRange: [neutralColors.white, neutralColors.error],
                  });
                  
                  const animatedStyle = {
                    left: anim.pan.x,
                    top: anim.pan.y,
                    transform: [
                      { scale: anim.scale },
                      { rotate: `${item.rotation}deg` },
                    ],
                    opacity: anim.opacity,
                  } as const;

                  return (
                    <Animated.View
                      key={item.id}
                      style={[
                        styles.canvasSticker,
                        {
                          width: item.width,
                          height: item.height,
                        },
                        animatedStyle,
                      ]}
                      {...(panResponder ? panResponder.panHandlers : {})}
                      pointerEvents="box-only"
                      testID={`sticker-${item.id}`}
                    >
                      <Animated.View style={[
                        styles.stickerOutline,
                        draggedSticker === item.id && styles.stickerOutlineDragging,
                        { borderColor: borderColorInterpolation },
                        (item.isOutOfBounds || item.isColliding) && styles.stickerOutlineError
                      ]}>
                        <Image
                          source={{ uri: item.sticker.stickerImage }}
                          style={styles.canvasStickerImage}
                        />
                      </Animated.View>
                      
                      {draggedSticker === item.id && (
                        <View style={[
                          styles.selectionIndicator,
                          (item.isOutOfBounds || item.isColliding) && styles.selectionIndicatorError
                        ]} />
                      )}
                      
                      {(item.isOutOfBounds || item.isColliding) && draggedSticker !== item.id && (
                        <View style={styles.errorBadge}>
                          <Text style={styles.errorBadgeText}>!</Text>
                        </View>
                      )}
                    </Animated.View>
                  );
                })}
                
                {draggedSticker && (
                  <View style={styles.floatingControls}>
                    <TouchableOpacity
                      style={styles.floatingButton}
                      onPress={() => rotateSticker(draggedSticker)}
                      testID="rotateStickerButton"
                    >
                      <RotateCcw size={18} color={neutralColors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.floatingButton, styles.floatingButtonDanger]}
                      onPress={() => removeStickerFromSheet(draggedSticker)}
                      testID="removeStickerButton"
                    >
                      <Trash2 size={18} color={neutralColors.white} />
                    </TouchableOpacity>
                  </View>
                )}
                
                <View style={[
                  styles.safeAreaGuide,
                  {
                    top: SAFE_MARGIN_CANVAS,
                    left: SAFE_MARGIN_CANVAS,
                    width: PRINTABLE_CANVAS_WIDTH,
                    height: PRINTABLE_CANVAS_HEIGHT,
                  }
                ]} />
                
                {selectedStickers.length === 0 && (
                  <View style={styles.canvasPlaceholder}>
                    <View style={styles.placeholderIcon}>
                      <Sparkles size={24} color={neutralColors.primary} />
                    </View>
                    <Text style={styles.canvasPlaceholderTitle}>
                      Professional Kiss-Cut Sheet
                    </Text>
                    <Text style={styles.canvasPlaceholderText}>
                      Drag stickers to arrange • Stay within dotted lines • No overlapping
                    </Text>
                  </View>
                )}
                
                {(validationErrors.outOfBounds.length > 0 || validationErrors.colliding.length > 0) && (
                  <View style={styles.validationWarning}>
                    <Text style={styles.validationWarningText}>
                      {validationErrors.outOfBounds.length > 0 && `${validationErrors.outOfBounds.length} outside safe area`}
                      {validationErrors.outOfBounds.length > 0 && validationErrors.colliding.length > 0 && ' • '}
                      {validationErrors.colliding.length > 0 && `${validationErrors.colliding.length} overlapping`}
                    </Text>
                  </View>
                )}
              </View>
              
              {selectedStickers.length > 1 && (
                <View style={styles.canvasControls}>
                  <TouchableOpacity
                    style={styles.arrangeButton}
                    onPress={arrangeStickersNeatly}
                    testID="autoArrangeButton"
                  >
                    <Grid3X3 size={16} color={neutralColors.primary} />
                    <Text style={styles.arrangeButtonText}>Auto Arrange</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.stickerLibrary}>
              <View style={styles.libraryHeader}>
                <View>
                  <Text style={styles.libraryTitle}>Your Memory Collection</Text>
                  <Text style={styles.librarySubtitle}>
                    Tap to add • {STICKER_SHEET_LAYOUTS[currentSheetSize as LayoutSheetSize].displayName} format • Up to {MAX_STICKERS} stickers
                  </Text>
                </View>
                <View style={styles.counterBadge}>
                  <Text style={styles.counterText}>{selectedStickers.length}/{MAX_STICKERS}</Text>
                </View>
              </View>
              
              <View style={styles.stickerGrid}>
                {savedStickers.map((sticker) => {
                  const addedCount = selectedStickers.filter(item => item.sticker.id === sticker.id).length;
                  return (
                    <TouchableOpacity
                      key={sticker.id}
                      style={[
                        styles.libraryStickerCard,
                        addedCount > 0 && styles.libraryStickerCardAdded,
                      ]}
                      onPress={() => addStickerToSheet(sticker)}
                      activeOpacity={0.7}
                      testID={`addSticker-${sticker.id}`}
                    >
                      <View style={[
                        styles.libraryStickerOutline,
                        addedCount > 0 && styles.libraryStickerOutlineAdded
                      ]}>
                        <Image
                          source={{ uri: sticker.stickerImage }}
                          style={styles.libraryStickerImage}
                        />
                      </View>
                      
                      <View style={[styles.addOverlay, addedCount > 0 && styles.addedOverlay]}>
                        <View style={[styles.addBadge, addedCount > 0 && styles.addedBadge]}>
                          {addedCount > 0 ? (
                            <Text style={styles.addedBadgeText}>{addedCount}</Text>
                          ) : (
                            <Plus size={18} color={neutralColors.white} />
                          )}
                        </View>
                      </View>
                      
                      {addedCount > 1 && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>×{addedCount}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </ScrollView>

        {selectedStickers.length > 0 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.checkoutButton, (isProcessing || isGeneratingSheet) && styles.buttonDisabled]}
              onPress={proceedToCheckout}
              disabled={isProcessing || isGeneratingSheet}
              testID="checkoutButton"
            >
              {(isProcessing || isGeneratingSheet) ? (
                <View style={styles.checkoutButtonContent}>
                  <ActivityIndicator size="small" color={neutralColors.white} />
                  <Text style={styles.checkoutButtonText}>
                    {isGeneratingSheet ? 'Generating Sheet...' : 'Processing...'}
                  </Text>
                </View>
              ) : (
                <View style={styles.checkoutButtonContent}>
                  <ShoppingCart size={20} color={neutralColors.white} />
                  <Text style={styles.checkoutButtonText}>
                    Order {STICKER_SHEET_LAYOUTS[currentSheetSize as LayoutSheetSize].displayName} Sheet ({currentStickerCount} stickers)
                  </Text>
                  <Download size={16} color={neutralColors.white} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
});

StickerSheetScreen.displayName = 'StickerSheetScreen';

export default StickerSheetScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: neutralColors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: neutralColors.border,
  },
  backButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: neutralColors.surface,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
  },
  clearButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: neutralColors.surface,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 80,
  },
  canvasContainer: {
    marginBottom: 24,
  },
  canvasTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  canvasTitleContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  canvasSubtitle: {
    fontSize: 12,
    color: neutralColors.text.secondary,
    marginTop: 2,
  },
  canvas: {
    width: CANVAS_SIZE,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: neutralColors.primary + '30',
    borderStyle: 'solid',
    position: 'relative',
    alignSelf: 'center',
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  safeAreaGuide: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: neutralColors.primary + '20',
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  canvasSticker: {
    position: 'absolute',
    zIndex: 1,
  },
  stickerOutline: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'visible',
    position: 'relative',
  },
  cutLineIndicator: {
    position: 'absolute',
  },
  cutLineError: {
    borderColor: neutralColors.error + '40',
    borderWidth: 2,
  },
  stickerOutlineDragging: {
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 1000,
  },
  stickerOutlineError: {
    borderWidth: 3,
    shadowColor: neutralColors.error,
  },
  canvasStickerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  selectionIndicator: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: neutralColors.primary + '80',
    backgroundColor: 'transparent',
  },
  selectionIndicatorError: {
    borderColor: neutralColors.error + '80',
  },
  errorBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: neutralColors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: neutralColors.white,
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  errorBadgeText: {
    color: neutralColors.white,
    fontSize: 12,
    fontWeight: 'bold' as const,
  },
  validationWarning: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: neutralColors.error + 'F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  validationWarningText: {
    color: neutralColors.white,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  floatingControls: {
    position: 'absolute',
    bottom: -60,
    left: '50%',
    transform: [{ translateX: -50 }],
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButton: {
    width: 40,
    height: 40,
    backgroundColor: neutralColors.primary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingButtonDanger: {
    backgroundColor: neutralColors.error,
  },
  canvasPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  placeholderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: neutralColors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  canvasPlaceholderTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
    textAlign: 'center',
    marginBottom: 6,
  },
  canvasPlaceholderText: {
    fontSize: 13,
    color: neutralColors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  canvasControls: {
    alignItems: 'center',
    marginTop: 12,
  },
  arrangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: neutralColors.white,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: neutralColors.primary + '40',
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  arrangeButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: neutralColors.primary,
  },
  stickerLibrary: {
    marginTop: 12,
  },
  libraryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  libraryTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: neutralColors.text.primary,
    marginBottom: 2,
  },
  librarySubtitle: {
    fontSize: 13,
    color: neutralColors.text.secondary,
  },
  counterBadge: {
    backgroundColor: neutralColors.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  counterText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: neutralColors.primary,
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  libraryStickerCard: {
    width: (screenWidth - 60) / 3,
    aspectRatio: 1,
    position: 'relative',
  },
  libraryStickerCardAdded: {
    opacity: 1,
  },
  libraryStickerOutline: {
    width: '100%',
    height: '100%',
    backgroundColor: neutralColors.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: neutralColors.border,
    overflow: 'hidden',
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  libraryStickerOutlineAdded: {
    borderColor: neutralColors.success,
    borderWidth: 3,
  },
  libraryStickerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  addOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 16,
  },
  addBadge: {
    width: 36,
    height: 36,
    backgroundColor: neutralColors.primary,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: neutralColors.white,
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  addedOverlay: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  addedBadge: {
    backgroundColor: neutralColors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: neutralColors.white,
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  addedBadgeText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: neutralColors.white,
  },
  countBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: neutralColors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: neutralColors.white,
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: neutralColors.white,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: neutralColors.white,
    borderTopWidth: 1,
    borderTopColor: neutralColors.border,
    padding: 20,
  },
  checkoutButton: {
    backgroundColor: neutralColors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  checkoutButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkoutButtonText: {
    color: neutralColors.white,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: neutralColors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  createFirstButton: {
    backgroundColor: neutralColors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  createFirstButtonText: {
    color: neutralColors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
