import React, { useState, useRef, useCallback, memo } from 'react';
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
import { router } from 'expo-router';
import { useUser, SavedSticker } from '@/contexts/UserContext';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';


const { width: screenWidth } = Dimensions.get('window');

// Printful kiss-cut sticker sheet specifications
// Based on Printful's requirements for seamless fulfillment
const PRINTFUL_SHEET_CONFIG = {
  // Kiss-cut sticker sheet dimensions (standard sizes)
  SHEET_SIZES: {
    SMALL: { WIDTH_INCHES: 4, HEIGHT_INCHES: 6, name: '4"×6"' },
    MEDIUM: { WIDTH_INCHES: 5.5, HEIGHT_INCHES: 8.5, name: '5.5"×8.5"' },
    LARGE: { WIDTH_INCHES: 8.5, HEIGHT_INCHES: 11, name: '8.5"×11"' },
  },
  // Current selected size (can be made dynamic)
  CURRENT_SIZE: 'MEDIUM',
  // High resolution for print quality
  DPI: 300,
  // Safe area margins (minimum distance from edges)
  SAFE_MARGIN_INCHES: 0.25,
  // Bleed area for kiss-cut (extends beyond cut line)
  BLEED_INCHES: 0.125,
  // Minimum spacing between stickers for clean cuts
  MIN_STICKER_SPACING_INCHES: 0.125, // Increased for better cut separation
  
  // Calculated properties
  get CURRENT_SHEET() { 
    return this.SHEET_SIZES[this.CURRENT_SIZE as keyof typeof this.SHEET_SIZES]; 
  },
  get WIDTH_PIXELS() { 
    return this.CURRENT_SHEET.WIDTH_INCHES * this.DPI; 
  },
  get HEIGHT_PIXELS() { 
    return this.CURRENT_SHEET.HEIGHT_INCHES * this.DPI; 
  },
  get SAFE_MARGIN_PIXELS() { 
    return this.SAFE_MARGIN_INCHES * this.DPI; 
  },
  get BLEED_PIXELS() { 
    return this.BLEED_INCHES * this.DPI; 
  },
  get MIN_SPACING_PIXELS() { 
    return this.MIN_STICKER_SPACING_INCHES * this.DPI; 
  },
  // Printable area (excluding safe margins)
  get PRINTABLE_WIDTH() { 
    return this.WIDTH_PIXELS - (this.SAFE_MARGIN_PIXELS * 2); 
  },
  get PRINTABLE_HEIGHT() { 
    return this.HEIGHT_PIXELS - (this.SAFE_MARGIN_PIXELS * 2); 
  },
};

// Canvas dimensions for UI (scaled down for mobile display)
const CANVAS_SIZE = screenWidth - 48; // 24px padding on each side
const CANVAS_ASPECT_RATIO = PRINTFUL_SHEET_CONFIG.CURRENT_SHEET.HEIGHT_INCHES / PRINTFUL_SHEET_CONFIG.CURRENT_SHEET.WIDTH_INCHES;
const CANVAS_HEIGHT = CANVAS_SIZE * CANVAS_ASPECT_RATIO;

// Sticker specifications
const STICKER_SIZE_INCHES = 1.25; // Smaller sticker size to fit more per sheet
const STICKER_SIZE_PIXELS = Math.floor((STICKER_SIZE_INCHES / PRINTFUL_SHEET_CONFIG.CURRENT_SHEET.WIDTH_INCHES) * CANVAS_SIZE);
const MAX_STICKERS = 24; // Maximum stickers per sheet
const STICKER_OUTLINE_WIDTH = 2;
const MIN_SPACING_PIXELS = Math.floor((PRINTFUL_SHEET_CONFIG.MIN_STICKER_SPACING_INCHES / PRINTFUL_SHEET_CONFIG.CURRENT_SHEET.WIDTH_INCHES) * CANVAS_SIZE);

// Safe area for sticker placement (scaled to canvas)
const SAFE_MARGIN_CANVAS = Math.floor((PRINTFUL_SHEET_CONFIG.SAFE_MARGIN_INCHES / PRINTFUL_SHEET_CONFIG.CURRENT_SHEET.WIDTH_INCHES) * CANVAS_SIZE);
const PRINTABLE_CANVAS_WIDTH = CANVAS_SIZE - (SAFE_MARGIN_CANVAS * 2);
const PRINTABLE_CANVAS_HEIGHT = CANVAS_HEIGHT - (SAFE_MARGIN_CANVAS * 2);

interface StickerPosition {
  id: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  sticker: SavedSticker;
  isOutOfBounds?: boolean;
  isColliding?: boolean;
}

const StickerSheetScreen = memo(() => {
  const { savedStickers } = useUser();
  const [selectedStickers, setSelectedStickers] = useState<StickerPosition[]>([]);
  const [isProcessing] = useState<boolean>(false);
  const [draggedSticker, setDraggedSticker] = useState<string | null>(null);
  const [isGeneratingSheet, setIsGeneratingSheet] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<{ outOfBounds: string[]; colliding: string[] }>({ outOfBounds: [], colliding: [] });
  const animatedValues = useRef<{ [key: string]: { pan: Animated.ValueXY; scale: Animated.Value; opacity: Animated.Value; borderColor: Animated.Value } }>({});
  const panResponders = useRef<{ [key: string]: any }>({});
  const canvasRef = useRef<View>(null);
  const dragStartPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const scrollViewRef = useRef<ScrollView>(null);

  const initializeAnimatedValues = useCallback((stickerId: string, x?: number, y?: number) => {
    if (!animatedValues.current[stickerId]) {
      animatedValues.current[stickerId] = {
        pan: new Animated.ValueXY({ x: x || 0, y: y || 0 }),
        scale: new Animated.Value(1),
        opacity: new Animated.Value(1),
        borderColor: new Animated.Value(0),
      };
    } else if (x !== undefined && y !== undefined) {
      // Update position if provided
      animatedValues.current[stickerId].pan.setValue({ x, y });
    }
  }, []);

  // Check if a sticker is within the safe area
  const isWithinBounds = useCallback((x: number, y: number): boolean => {
    return (
      x >= SAFE_MARGIN_CANVAS &&
      x <= SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_WIDTH - STICKER_SIZE_PIXELS &&
      y >= SAFE_MARGIN_CANVAS &&
      y <= SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_HEIGHT - STICKER_SIZE_PIXELS
    );
  }, []);

  // Check if two stickers are colliding
  const checkCollision = useCallback((x1: number, y1: number, x2: number, y2: number): boolean => {
    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    return distance < STICKER_SIZE_PIXELS + MIN_SPACING_PIXELS;
  }, []);

  // Find a valid position that doesn't collide with other stickers
  const findValidPosition = useCallback((targetX: number, targetY: number, currentId: string): { x: number; y: number; isValid: boolean } => {
    // First, constrain to bounds
    let x = Math.max(SAFE_MARGIN_CANVAS, Math.min(SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_WIDTH - STICKER_SIZE_PIXELS, targetX));
    let y = Math.max(SAFE_MARGIN_CANVAS, Math.min(SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_HEIGHT - STICKER_SIZE_PIXELS, targetY));
    
    // Check for collisions with other stickers
    const otherStickers = selectedStickers.filter(s => s.id !== currentId);
    let hasCollision = false;
    
    for (const other of otherStickers) {
      if (checkCollision(x, y, other.x, other.y)) {
        hasCollision = true;
        // Try to find a nearby valid position
        const angle = Math.atan2(y - other.y, x - other.x);
        const pushDistance = STICKER_SIZE_PIXELS + MIN_SPACING_PIXELS + 2;
        x = other.x + Math.cos(angle) * pushDistance;
        y = other.y + Math.sin(angle) * pushDistance;
        
        // Re-constrain to bounds
        x = Math.max(SAFE_MARGIN_CANVAS, Math.min(SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_WIDTH - STICKER_SIZE_PIXELS, x));
        y = Math.max(SAFE_MARGIN_CANVAS, Math.min(SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_HEIGHT - STICKER_SIZE_PIXELS, y));
      }
    }
    
    // Final validation
    const isValid = isWithinBounds(x, y) && !otherStickers.some(other => checkCollision(x, y, other.x, other.y));
    
    return { x, y, isValid };
  }, [selectedStickers, isWithinBounds, checkCollision]);

  // Validate all sticker positions
  const validatePositions = useCallback(() => {
    const outOfBounds: string[] = [];
    const colliding: string[] = [];
    
    selectedStickers.forEach((sticker, index) => {
      // Check bounds
      if (!isWithinBounds(sticker.x, sticker.y)) {
        outOfBounds.push(sticker.id);
      }
      
      // Check collisions with other stickers
      for (let j = index + 1; j < selectedStickers.length; j++) {
        const other = selectedStickers[j];
        if (checkCollision(sticker.x, sticker.y, other.x, other.y)) {
          if (!colliding.includes(sticker.id)) colliding.push(sticker.id);
          if (!colliding.includes(other.id)) colliding.push(other.id);
        }
      }
    });
    
    setValidationErrors({ outOfBounds, colliding });
    
    // Update sticker states
    setSelectedStickers(prev => 
      prev.map(sticker => ({
        ...sticker,
        isOutOfBounds: outOfBounds.includes(sticker.id),
        isColliding: colliding.includes(sticker.id),
      }))
    );
    
    // Animate border colors for invalid stickers
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

    // Calculate optimal grid layout that fits within printable area
    // Start with a reasonable grid based on sticker count
    const count = selectedStickers.length;
    let cols = Math.min(6, Math.ceil(Math.sqrt(count)));
    let rows = Math.ceil(count / cols);
    
    // Use proper spacing to prevent overlaps and ensure clean cuts
    const spacingX = MIN_SPACING_PIXELS + 10; // Extra space for clean cutting
    const spacingY = MIN_SPACING_PIXELS + 10;
    
    // Calculate total dimensions
    let totalWidth = cols * STICKER_SIZE_PIXELS + (cols - 1) * spacingX;
    let totalHeight = rows * STICKER_SIZE_PIXELS + (rows - 1) * spacingY;
    
    // Optimize grid layout to fit within printable area
    let attempts = 0;
    const maxAttempts = 30;
    
    while ((totalWidth > PRINTABLE_CANVAS_WIDTH || totalHeight > PRINTABLE_CANVAS_HEIGHT) && attempts < maxAttempts) {
      // Try to adjust the grid to fit
      if (totalWidth > PRINTABLE_CANVAS_WIDTH) {
        // Width exceeds, reduce columns
        cols = Math.max(1, cols - 1);
        rows = Math.ceil(count / cols);
      } else if (totalHeight > PRINTABLE_CANVAS_HEIGHT) {
        // Height exceeds, add more columns
        cols = Math.min(6, cols + 1);
        rows = Math.ceil(count / cols);
      }
      
      // Recalculate dimensions
      totalWidth = cols * STICKER_SIZE_PIXELS + (cols - 1) * spacingX;
      totalHeight = rows * STICKER_SIZE_PIXELS + (rows - 1) * spacingY;
      attempts++;
    }
    
    // Ensure we can fit all stickers
    const maxStickersInGrid = cols * rows;
    if (maxStickersInGrid < count) {
      // Adjust grid to fit all stickers
      rows = Math.ceil(count / cols);
      totalHeight = rows * STICKER_SIZE_PIXELS + (rows - 1) * spacingY;
    }
    
    // Calculate centered starting position - ensure we stay within bounds
    const startX = SAFE_MARGIN_CANVAS + Math.max(0, Math.floor((PRINTABLE_CANVAS_WIDTH - totalWidth) / 2));
    const startY = SAFE_MARGIN_CANVAS + Math.max(0, Math.floor((PRINTABLE_CANVAS_HEIGHT - totalHeight) / 2));

    // Create new positions array with proper spacing
    const newPositions = selectedStickers.map((item, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      
      let x = startX + col * (STICKER_SIZE_PIXELS + spacingX);
      let y = startY + row * (STICKER_SIZE_PIXELS + spacingY);
      
      // Ensure position is within bounds
      x = Math.max(SAFE_MARGIN_CANVAS, Math.min(SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_WIDTH - STICKER_SIZE_PIXELS, x));
      y = Math.max(SAFE_MARGIN_CANVAS, Math.min(SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_HEIGHT - STICKER_SIZE_PIXELS, y));
      
      return {
        ...item,
        x,
        y,
        rotation: 0,
        isOutOfBounds: false,
        isColliding: false,
      };
    });
    
    // Verify no overlaps and all within bounds
    let hasIssues = false;
    for (let i = 0; i < newPositions.length; i++) {
      // Check bounds
      if (!isWithinBounds(newPositions[i].x, newPositions[i].y)) {
        newPositions[i].isOutOfBounds = true;
        hasIssues = true;
      }
      
      // Check collisions
      for (let j = i + 1; j < newPositions.length; j++) {
        if (checkCollision(newPositions[i].x, newPositions[i].y, newPositions[j].x, newPositions[j].y)) {
          newPositions[i].isColliding = true;
          newPositions[j].isColliding = true;
          hasIssues = true;
        }
      }
    }
    
    if (hasIssues) {
      console.warn('Auto-arrange resulted in some stickers outside bounds or overlapping');
    }
    
    setSelectedStickers(newPositions);
    
    // Clear validation errors after arranging
    setValidationErrors({ outOfBounds: [], colliding: [] });
    
    // Clear pan responders to reset drag state
    panResponders.current = {};
    animatedValues.current = {};
    
    // Run validation after a short delay to ensure state is updated
    setTimeout(() => validatePositions(), 100);
  }, [selectedStickers, isWithinBounds, checkCollision, validatePositions]);

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
        // Store the starting position of the sticker
        startX = currentX;
        startY = currentY;
        
        // Store the initial touch position
        initialTouchX = evt.nativeEvent.locationX;
        initialTouchY = evt.nativeEvent.locationY;
        
        dragStartPosition.current = { x: currentX, y: currentY };
        
        // Immediate UI feedback
        setDraggedSticker(stickerId);
        
        // Reset animated values for smooth dragging
        if (animatedValues.current[stickerId]) {
          // Clear any previous offset
          animatedValues.current[stickerId].pan.flattenOffset();
          // Set the starting position
          animatedValues.current[stickerId].pan.setValue({ 
            x: currentX, 
            y: currentY 
          });
          
          // Instant scale and opacity change for better feedback
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
        // Calculate the new position based on gesture movement
        if (animatedValues.current[stickerId]) {
          // Calculate position accounting for where the user touched the sticker
          const touchOffsetX = initialTouchX - (STICKER_SIZE_PIXELS / 2);
          const touchOffsetY = initialTouchY - (STICKER_SIZE_PIXELS / 2);
          
          // Use the starting position plus the gesture delta minus the touch offset
          const newX = startX + gestureState.dx - touchOffsetX;
          const newY = startY + gestureState.dy - touchOffsetY;
          
          animatedValues.current[stickerId].pan.setValue({
            x: newX,
            y: newY,
          });
          
          // Check bounds for visual feedback
          const inBounds = isWithinBounds(newX, newY);
          
          // Update border color immediately for visual feedback
          Animated.timing(animatedValues.current[stickerId].borderColor, {
            toValue: !inBounds ? 1 : 0,
            duration: 0,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setDraggedSticker(null);
        
        // Calculate final position accounting for touch offset
        const touchOffsetX = initialTouchX - (STICKER_SIZE_PIXELS / 2);
        const touchOffsetY = initialTouchY - (STICKER_SIZE_PIXELS / 2);
        const targetX = startX + gestureState.dx - touchOffsetX;
        const targetY = startY + gestureState.dy - touchOffsetY;
        
        // Find valid position (with collision detection)
        const { x: finalX, y: finalY, isValid } = findValidPosition(targetX, targetY, stickerId);
        
        // Immediately update the state to prevent rubber banding
        setSelectedStickers(prev => {
          const updated = prev.map(item => {
            if (item.id === stickerId) {
              // Clear old pan responder to force recreation with new position
              delete panResponders.current[stickerId];
              return { 
                ...item, 
                x: finalX, 
                y: finalY,
                isOutOfBounds: !isWithinBounds(finalX, finalY),
                isColliding: false
              };
            }
            return item;
          });
          return updated;
        });
        
        // Animate to final position without spring to avoid rubber banding
        if (animatedValues.current[stickerId]) {
          // Set the final position immediately to prevent visual jump
          animatedValues.current[stickerId].pan.setValue({ x: finalX, y: finalY });
          
          // Animate scale and opacity back to normal
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
        
        // Validate positions after update
        setTimeout(() => validatePositions(), 100);
      },
    });
  }, [initializeAnimatedValues, isWithinBounds, validatePositions, findValidPosition]);

  const addStickerToSheet = useCallback((sticker: SavedSticker) => {
    console.log('Adding sticker to sheet. Current count:', selectedStickers.length);
    console.log('MAX_STICKERS:', MAX_STICKERS);
    
    if (selectedStickers.length >= MAX_STICKERS) {
      Alert.alert('Maximum Reached', `You can add up to ${MAX_STICKERS} stickers per sheet.`);
      return;
    }

    // Smart placement algorithm - try to find the best position
    let x = 0;
    let y = 0;
    let positionFound = false;
    
    // Calculate optimal grid for current stickers + 1
    const targetCount = selectedStickers.length + 1;
    console.log('Target count for grid:', targetCount);
    
    // Better grid calculation for small numbers
    let cols = 1;
    let rows = 1;
    
    if (targetCount <= 4) {
      // For 1-4 stickers, use a single row
      cols = Math.min(4, targetCount);
      rows = 1;
    } else if (targetCount <= 8) {
      // For 5-8 stickers, use 2 rows
      cols = 4;
      rows = Math.ceil(targetCount / 4);
    } else if (targetCount <= 12) {
      // For 9-12 stickers, use 3 rows
      cols = 4;
      rows = Math.ceil(targetCount / 4);
    } else if (targetCount <= 18) {
      // For 13-18 stickers, use up to 6 columns
      cols = 6;
      rows = Math.ceil(targetCount / 6);
    } else {
      // For 19-24 stickers
      cols = 6;
      rows = Math.ceil(targetCount / cols);
    }
    
    console.log('Grid layout - cols:', cols, 'rows:', rows);
    
    const spacingX = STICKER_SIZE_PIXELS + MIN_SPACING_PIXELS + 10;
    const spacingY = STICKER_SIZE_PIXELS + MIN_SPACING_PIXELS + 10;
    
    // Calculate total grid dimensions
    const totalWidth = cols * STICKER_SIZE_PIXELS + (cols - 1) * (MIN_SPACING_PIXELS + 10);
    const totalHeight = rows * STICKER_SIZE_PIXELS + (rows - 1) * (MIN_SPACING_PIXELS + 10);
    
    console.log('Total grid dimensions - width:', totalWidth, 'height:', totalHeight);
    console.log('Printable area - width:', PRINTABLE_CANVAS_WIDTH, 'height:', PRINTABLE_CANVAS_HEIGHT);
    
    // Center the grid
    const startX = SAFE_MARGIN_CANVAS + Math.max(0, Math.floor((PRINTABLE_CANVAS_WIDTH - totalWidth) / 2));
    const startY = SAFE_MARGIN_CANVAS + Math.max(0, Math.floor((PRINTABLE_CANVAS_HEIGHT - totalHeight) / 2));
    
    console.log('Grid start position - x:', startX, 'y:', startY);
    
    // Try to find the next available grid position
    const gridPositions: { x: number; y: number }[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const gridX = startX + col * spacingX;
        const gridY = startY + row * spacingY;
        console.log(`Grid position [${row},${col}] - x:${gridX}, y:${gridY}`);
        if (isWithinBounds(gridX, gridY)) {
          gridPositions.push({ x: gridX, y: gridY });
          console.log('Position is within bounds');
        } else {
          console.log('Position is OUT OF BOUNDS');
        }
      }
    }
    
    console.log('Total valid grid positions:', gridPositions.length);
    
    // Find first unoccupied grid position
    for (const pos of gridPositions) {
      const hasCollision = selectedStickers.some(existing => 
        checkCollision(pos.x, pos.y, existing.x, existing.y)
      );
      
      console.log(`Checking position x:${pos.x}, y:${pos.y} - collision:${hasCollision}`);
      
      if (!hasCollision) {
        x = pos.x;
        y = pos.y;
        positionFound = true;
        console.log('Found valid position!');
        break;
      }
    }
    
    // If no grid position available, find any valid spot
    if (!positionFound) {
      // Scan for empty space with smaller steps
      const step = 20;
      for (let testY = SAFE_MARGIN_CANVAS; testY <= SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_HEIGHT - STICKER_SIZE_PIXELS && !positionFound; testY += step) {
        for (let testX = SAFE_MARGIN_CANVAS; testX <= SAFE_MARGIN_CANVAS + PRINTABLE_CANVAS_WIDTH - STICKER_SIZE_PIXELS && !positionFound; testX += step) {
          const hasCollision = selectedStickers.some(existing => 
            checkCollision(testX, testY, existing.x, existing.y)
          );
          
          if (!hasCollision) {
            x = testX;
            y = testY;
            positionFound = true;
          }
        }
      }
    }
    
    // If still no position, auto-arrange with the new sticker
    if (!positionFound) {
      // Add the sticker temporarily and auto-arrange
      const tempPosition: StickerPosition = {
        id: `${sticker.id}-${Date.now()}-${Math.random()}`,
        x: SAFE_MARGIN_CANVAS,
        y: SAFE_MARGIN_CANVAS,
        rotation: 0,
        scale: 1,
        sticker,
        isOutOfBounds: false,
        isColliding: true,
      };
      setSelectedStickers(prev => {
        const newList = [...prev, tempPosition];
        // Auto-arrange immediately
        setTimeout(() => arrangeStickersNeatly(), 50);
        return newList;
      });
      return;
    }
    
    const newPosition: StickerPosition = {
      id: `${sticker.id}-${Date.now()}-${Math.random()}`, // Ensure uniqueness for multiple same stickers
      x,
      y,
      rotation: 0,
      scale: 1,
      sticker,
      isOutOfBounds: false,
      isColliding: false,
    };

    console.log('Adding new sticker at position:', { x, y });
    console.log('New sticker ID:', newPosition.id);
    
    setSelectedStickers(prev => {
      const updated = [...prev, newPosition];
      console.log('Updated stickers count:', updated.length);
      return updated;
    });
    
    // Validate positions after adding
    setTimeout(() => validatePositions(), 100);
  }, [selectedStickers, isWithinBounds, checkCollision, validatePositions, arrangeStickersNeatly]);

  const removeStickerFromSheet = useCallback((positionId: string) => {
    setSelectedStickers(prev => {
      // Update pan responders when position changes
      const updatedStickers = prev.filter(item => item.id !== positionId);
      // Clear the pan responder for removed sticker
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

      const canvas = document.createElement('canvas');
      canvas.width = PRINTFUL_SHEET_CONFIG.WIDTH_PIXELS;
      canvas.height = PRINTFUL_SHEET_CONFIG.HEIGHT_PIXELS;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Set white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let loadedImages = 0;
      const totalImages = selectedStickers.length;
      
      if (totalImages === 0) {
        resolve(canvas.toDataURL('image/png'));
        return;
      }

      // Calculate scale factor from canvas to printful dimensions
      const scaleX = PRINTFUL_SHEET_CONFIG.WIDTH_PIXELS / CANVAS_SIZE;
      const scaleY = PRINTFUL_SHEET_CONFIG.HEIGHT_PIXELS / CANVAS_HEIGHT;
      
      // Draw safe area guidelines (light gray background)
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw printable area (white background)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(
        PRINTFUL_SHEET_CONFIG.SAFE_MARGIN_PIXELS,
        PRINTFUL_SHEET_CONFIG.SAFE_MARGIN_PIXELS,
        PRINTFUL_SHEET_CONFIG.PRINTABLE_WIDTH,
        PRINTFUL_SHEET_CONFIG.PRINTABLE_HEIGHT
      );
      
      // Add subtle border for printable area
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        PRINTFUL_SHEET_CONFIG.SAFE_MARGIN_PIXELS,
        PRINTFUL_SHEET_CONFIG.SAFE_MARGIN_PIXELS,
        PRINTFUL_SHEET_CONFIG.PRINTABLE_WIDTH,
        PRINTFUL_SHEET_CONFIG.PRINTABLE_HEIGHT
      );
      
      selectedStickers.forEach((stickerPos) => {
        const img = new (window as any).Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          // Calculate position and size in high-res coordinates
          const x = stickerPos.x * scaleX;
          const y = stickerPos.y * scaleY;
          const width = STICKER_SIZE_PIXELS * scaleX;
          const height = STICKER_SIZE_PIXELS * scaleY;
          
          // Add bleed area for kiss-cut stickers
          const bleedWidth = width + (PRINTFUL_SHEET_CONFIG.BLEED_PIXELS * 2);
          const bleedHeight = height + (PRINTFUL_SHEET_CONFIG.BLEED_PIXELS * 2);
          
          // Save context for rotation
          ctx.save();
          
          // Move to center of sticker for rotation
          ctx.translate(x + width / 2, y + height / 2);
          ctx.rotate((stickerPos.rotation * Math.PI) / 180);
          
          // Draw image with bleed area for proper kiss-cut
          ctx.drawImage(img, -bleedWidth / 2, -bleedHeight / 2, bleedWidth, bleedHeight);
          
          // Add subtle cut line indicator (very light, won't affect print)
          ctx.strokeStyle = 'rgba(0,0,0,0.05)';
          ctx.lineWidth = 1;
          ctx.strokeRect(-width / 2, -height / 2, width, height);
          
          // Restore context
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
  }, [selectedStickers]);

  const generateStickerSheetMobile = useCallback(async (): Promise<string> => {
    if (!canvasRef.current) {
      throw new Error('Canvas reference not available');
    }

    try {
      // Capture the current canvas view
      const uri = await captureRef(canvasRef.current, {
        format: 'png',
        quality: 1.0,
        width: PRINTFUL_SHEET_CONFIG.WIDTH_PIXELS,
        height: PRINTFUL_SHEET_CONFIG.HEIGHT_PIXELS,
      });

      // Read the file and convert to base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return `data:image/png;base64,${base64}`;
    } catch (error) {
      console.error('Error capturing sticker sheet:', error);
      throw error;
    }
  }, []);

  const generateStickerSheetImage = useCallback(async (): Promise<string> => {
    try {
      console.log('Generating sticker sheet composite image...');
      
      if (Platform.OS === 'web') {
        // Web implementation using Canvas API
        return await generateStickerSheetWeb();
      } else {
        // Mobile implementation using react-native-view-shot
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
    
    // Check for validation errors
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
      console.log('Generating high-resolution sticker sheet for Printful...');
      
      // Generate the composite sticker sheet image
      const stickerSheetImage = await generateStickerSheetImage();
      
      console.log('Sticker sheet generated successfully');
      
      // Navigate to checkout with the generated image
      router.push({
        pathname: '/checkout',
        params: {
          originalImage: 'sticker-sheet',
          finalStickers: stickerSheetImage,
          isReorder: 'false',
          isStickerSheet: 'true',
          stickerCount: selectedStickers.length.toString(),
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
  }, [selectedStickers, validationErrors, arrangeStickersNeatly, generateStickerSheetImage]);

  if (savedStickers.length === 0) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={24} color={neutralColors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Sticker Sheet</Text>
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
          <Text style={styles.headerTitle}>Create Sticker Sheet</Text>
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
                  {PRINTFUL_SHEET_CONFIG.CURRENT_SHEET.name} Kiss-Cut Sheet
                </Text>
                <Text style={styles.canvasSubtitle}>
                  {selectedStickers.length}/{MAX_STICKERS} stickers • Print-ready format
                </Text>
              </View>
              <View 
                ref={canvasRef}
                style={[styles.canvas, { height: CANVAS_HEIGHT }]}
                collapsable={false}
              >
                {selectedStickers.map((item) => {
                  // Initialize animated values with current position only if not dragging
                  if (draggedSticker !== item.id) {
                    initializeAnimatedValues(item.id, item.x, item.y);
                  }
                  
                  // Create pan responder with current position - recreate if position changed and not dragging
                  if (!panResponders.current[item.id] && draggedSticker !== item.id) {
                    panResponders.current[item.id] = createPanResponder(item.id, item.x, item.y);
                  }
                  const panResponder = panResponders.current[item.id];
                  
                  const borderColorInterpolation = animatedValues.current[item.id].borderColor.interpolate({
                    inputRange: [0, 1],
                    outputRange: [neutralColors.white, neutralColors.error],
                  });
                  
                  // Use absolute positioning with animated values
                  const animatedStyle = {
                    left: animatedValues.current[item.id].pan.x,
                    top: animatedValues.current[item.id].pan.y,
                    transform: [
                      { scale: animatedValues.current[item.id].scale },
                      { rotate: `${item.rotation}deg` },
                    ],
                    opacity: animatedValues.current[item.id].opacity,
                  };

                  return (
                    <Animated.View
                      key={item.id}
                      style={[
                        styles.canvasSticker,
                        {
                          width: STICKER_SIZE_PIXELS,
                          height: STICKER_SIZE_PIXELS,
                        },
                        animatedStyle,
                      ]}
                      {...panResponder.panHandlers}
                      pointerEvents="box-only"
                    >
                      {/* Kiss-cut sticker with bleed area */}
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
                        {/* Cut line indicator */}
                        <View style={[
                          styles.cutLineIndicator,
                          (item.isOutOfBounds || item.isColliding) && styles.cutLineError
                        ]} />
                      </Animated.View>
                      
                      {/* Selection and error indicators */}
                      {draggedSticker === item.id && (
                        <View style={[
                          styles.selectionIndicator,
                          (item.isOutOfBounds || item.isColliding) && styles.selectionIndicatorError
                        ]} />
                      )}
                      
                      {/* Error badge */}
                      {(item.isOutOfBounds || item.isColliding) && draggedSticker !== item.id && (
                        <View style={styles.errorBadge}>
                          <Text style={styles.errorBadgeText}>!</Text>
                        </View>
                      )}
                    </Animated.View>
                  );
                })}
                
                {/* Floating action menu for selected sticker */}
                {draggedSticker && (
                  <View style={styles.floatingControls}>
                    <TouchableOpacity
                      style={styles.floatingButton}
                      onPress={() => rotateSticker(draggedSticker)}
                    >
                      <RotateCcw size={18} color={neutralColors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.floatingButton, styles.floatingButtonDanger]}
                      onPress={() => removeStickerFromSheet(draggedSticker)}
                    >
                      <Trash2 size={18} color={neutralColors.white} />
                    </TouchableOpacity>
                  </View>
                )}
                
                {/* Safe area guidelines */}
                <View style={styles.safeAreaGuide} />
                
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
                
                {/* Validation status */}
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
                    Tap to add • {PRINTFUL_SHEET_CONFIG.CURRENT_SHEET.name} format • Up to {MAX_STICKERS} stickers
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
            >
              {(isProcessing || isGeneratingSheet) ? (
                <>
                  <ActivityIndicator size="small" color={neutralColors.white} />
                  <Text style={styles.checkoutButtonText}>
                    {isGeneratingSheet ? 'Generating Sheet...' : 'Processing...'}
                  </Text>
                </>
              ) : (
                <>
                  <ShoppingCart size={20} color={neutralColors.white} />
                  <Text style={styles.checkoutButtonText}>
                    Order {PRINTFUL_SHEET_CONFIG.CURRENT_SHEET.name} Sheet ($16.99)
                  </Text>
                  <Download size={16} color={neutralColors.white} />
                </>
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
    top: SAFE_MARGIN_CANVAS,
    left: SAFE_MARGIN_CANVAS,
    width: PRINTABLE_CANVAS_WIDTH,
    height: PRINTABLE_CANVAS_HEIGHT,
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
    borderRadius: Math.floor(STICKER_SIZE_PIXELS * 0.15),
    borderWidth: STICKER_OUTLINE_WIDTH,
    borderColor: neutralColors.white,
    backgroundColor: neutralColors.white,
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  cutLineIndicator: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: Math.floor(STICKER_SIZE_PIXELS * 0.15),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderStyle: 'dashed',
  },
  cutLineError: {
    borderColor: neutralColors.error + '40',
    borderWidth: 2,
  },
  stickerOutlineDragging: {
    borderColor: neutralColors.primary + '60',
    borderWidth: 3,
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
    width: (screenWidth - 60) / 3, // 3 columns with gaps
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