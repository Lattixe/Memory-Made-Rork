import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Trash2, ShoppingCart, Edit3, ArrowLeft, Grid3X3, Grid2X2, LayoutGrid } from 'lucide-react-native';
import { neutralColors } from '@/constants/colors';
import { SavedSticker } from '@/contexts/UserContext';
import { router } from 'expo-router';
import ImageGalleryModal from './ImageGalleryModal';

const { width: screenWidth } = Dimensions.get('window');
const GRID_PADDING = 16;

type GridSize = 2 | 3 | 4;

const getGridLayout = (gridSize: GridSize) => {
  const itemGap = gridSize === 2 ? 12 : gridSize === 3 ? 8 : 4;
  const itemWidth = (screenWidth - (GRID_PADDING * 2) - (itemGap * (gridSize - 1))) / gridSize;
  return { itemGap, itemWidth };
};


interface StickerGalleryProps {
  stickers: SavedSticker[];
  onDeleteSticker: (stickerId: string) => Promise<void>;
  onSelectSticker: (sticker: SavedSticker) => void;
  onBack?: () => void;
}

export default function StickerGallery({ stickers, onDeleteSticker, onSelectSticker, onBack }: StickerGalleryProps) {
  const [galleryVisible, setGalleryVisible] = useState<boolean>(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [gridSize, setGridSize] = useState<GridSize>(2);
  const [selectedStickers, setSelectedStickers] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  
  const { itemGap, itemWidth } = getGridLayout(gridSize);
  
  const handleDeleteSticker = useCallback((sticker: SavedSticker) => {
    Alert.alert(
      'Delete Sticker',
      'Are you sure you want to delete this sticker? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteSticker(sticker.id),
        },
      ]
    );
  }, [onDeleteSticker]);

  const handleReorderSticker = useCallback((sticker: SavedSticker) => {
    Alert.alert(
      'Reorder Options',
      'How would you like to reorder this sticker?',
      [
        {
          text: 'Single Sticker',
          onPress: () => {
            router.push({
              pathname: '/checkout',
              params: {
                stickerId: sticker.id,
                originalImage: sticker.originalImage,
                finalStickers: sticker.stickerImage,
                isReorder: 'true',
              },
            });
          },
        },
        {
          text: 'Mini Sticker Sheet',
          onPress: () => {
            router.push({
              pathname: '/sheet-size-selection',
              params: {
                stickerImage: sticker.stickerImage,
                originalImage: sticker.originalImage,
                isReorder: 'true',
              },
            });
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  }, []);

  const handleEditSticker = useCallback((sticker: SavedSticker) => {
    // Pass both sticker data and ID for instant navigation
    router.push({
      pathname: '/edit',
      params: {
        stickerId: sticker.id,
        originalImage: sticker.originalImage,
        stickerImage: sticker.stickerImage,
      },
    });
  }, []);



  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const toggleSelection = useCallback((stickerId: string) => {
    setSelectedStickers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stickerId)) {
        newSet.delete(stickerId);
      } else {
        newSet.add(stickerId);
      }
      if (newSet.size === 0) {
        setSelectionMode(false);
      }
      return newSet;
    });
  }, []);

  const handleLongPress = useCallback((stickerId: string) => {
    setSelectionMode(true);
    toggleSelection(stickerId);
  }, [toggleSelection]);

  const cycleGridSize = useCallback(() => {
    setGridSize(prev => {
      if (prev === 2) return 3;
      if (prev === 3) return 4;
      return 2;
    });
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (selectedStickers.size === 0) return;
    
    Alert.alert(
      'Delete Stickers',
      `Are you sure you want to delete ${selectedStickers.size} ${selectedStickers.size === 1 ? 'sticker' : 'stickers'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            for (const stickerId of selectedStickers) {
              await onDeleteSticker(stickerId);
            }
            setSelectedStickers(new Set());
            setSelectionMode(false);
          },
        },
      ]
    );
  }, [selectedStickers, onDeleteSticker]);

  const renderStickerCard = useCallback((item: SavedSticker, index: number) => {
    const isSelected = selectedStickers.has(item.id);
    const isNotLastInRow = (index + 1) % gridSize !== 0;
    const cardStyle = {
      width: itemWidth,
      aspectRatio: 1,
      marginBottom: itemGap,
      marginRight: isNotLastInRow ? itemGap : 0,
    };
    
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.stickerCard, cardStyle, isSelected && styles.stickerCardSelected]}
        onPress={() => {
          if (selectionMode) {
            toggleSelection(item.id);
          } else {
            const index = stickers.findIndex(s => s.id === item.id);
            setSelectedImageIndex(index);
            setGalleryVisible(true);
          }
        }}
        onLongPress={() => handleLongPress(item.id)}
        activeOpacity={0.8}
      >
        <Image 
          source={{ uri: item.stickerImage }} 
          style={styles.stickerImage}
          resizeMode="cover"
        />
        {isSelected && (
          <View style={styles.selectionOverlay}>
            <View style={styles.checkmark}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          </View>
        )}
        {gridSize === 2 && (
          <View style={styles.dateOverlay}>
            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [stickers, itemWidth, itemGap, gridSize, selectionMode, selectedStickers, formatDate, toggleSelection, handleLongPress]);

  if (stickers.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No saved memories yet</Text>
        <Text style={styles.emptySubtitle}>
          Create your first memory sticker and it will appear here for easy reordering
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack && !selectionMode && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={24} color={neutralColors.text.primary} />
          </TouchableOpacity>
        )}
        {selectionMode && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setSelectionMode(false);
              setSelectedStickers(new Set());
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>
            {selectionMode ? `${selectedStickers.size} Selected` : 'Your Memories'}
          </Text>
          {!selectionMode && (
            <Text style={styles.subtitle}>
              {stickers.length} {stickers.length === 1 ? 'sticker' : 'stickers'}
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {selectionMode ? (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleBulkDelete}
              disabled={selectedStickers.size === 0}
              activeOpacity={0.7}
            >
              <Trash2 size={20} color={selectedStickers.size > 0 ? neutralColors.error : neutralColors.gray400} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.gridSizeButton}
              onPress={cycleGridSize}
              activeOpacity={0.7}
            >
              {gridSize === 2 && <Grid2X2 size={20} color={neutralColors.text.primary} />}
              {gridSize === 3 && <Grid3X3 size={20} color={neutralColors.text.primary} />}
              {gridSize === 4 && <LayoutGrid size={20} color={neutralColors.text.primary} />}
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {stickers.map((sticker, index) => renderStickerCard(sticker, index))}
        </View>
      </ScrollView>

      <ImageGalleryModal
        visible={galleryVisible}
        stickers={stickers}
        initialIndex={selectedImageIndex}
        onClose={() => setGalleryVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: neutralColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: GRID_PADDING,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: neutralColors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: neutralColors.primary,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: neutralColors.text.primary,
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: neutralColors.text.secondary,
    fontWeight: '400' as const,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  gridSizeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: neutralColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: neutralColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 32,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  stickerCard: {
    backgroundColor: neutralColors.gray100,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 0,
  },
  stickerCardSelected: {
    opacity: 0.7,
  },
  stickerImage: {
    width: '100%',
    height: '100%',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: neutralColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: neutralColors.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  dateOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 4,
  },
  dateText: {
    fontSize: 10,
    color: neutralColors.white,
    fontWeight: '600' as const,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: neutralColors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});