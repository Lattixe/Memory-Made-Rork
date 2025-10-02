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
import { Trash2, ShoppingCart, Edit3, ArrowLeft } from 'lucide-react-native';
import { neutralColors } from '@/constants/colors';
import { SavedSticker } from '@/contexts/UserContext';
import { router } from 'expo-router';
import ImageGalleryModal from './ImageGalleryModal';

const { width: screenWidth } = Dimensions.get('window');
const GRID_PADDING = 20;
const ITEM_GAP = 16;
const ITEMS_PER_ROW = 2;
const ITEM_WIDTH = (screenWidth - (GRID_PADDING * 2) - (ITEM_GAP * (ITEMS_PER_ROW - 1))) / ITEMS_PER_ROW;


interface StickerGalleryProps {
  stickers: SavedSticker[];
  onDeleteSticker: (stickerId: string) => Promise<void>;
  onSelectSticker: (sticker: SavedSticker) => void;
  onBack?: () => void;
}

export default function StickerGallery({ stickers, onDeleteSticker, onSelectSticker, onBack }: StickerGalleryProps) {
  const [galleryVisible, setGalleryVisible] = useState<boolean>(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  
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

  const renderStickerCard = useCallback((item: SavedSticker) => (
    <View key={item.id} style={styles.stickerCard}>
      <TouchableOpacity
        style={styles.stickerImageContainer}
        onPress={() => {
          const index = stickers.findIndex(s => s.id === item.id);
          setSelectedImageIndex(index);
          setGalleryVisible(true);
        }}
        activeOpacity={0.95}
      >
        <Image 
          source={{ uri: item.stickerImage }} 
          style={styles.stickerImage}
          resizeMode="contain"
        />
        <View style={styles.imageOverlay}>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleEditSticker(item)}
          activeOpacity={0.7}
        >
          <Edit3 size={18} color={neutralColors.text.primary} strokeWidth={2} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleReorderSticker(item)}
          activeOpacity={0.7}
        >
          <ShoppingCart size={18} color={neutralColors.text.primary} strokeWidth={2} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleDeleteSticker(item)}
          activeOpacity={0.7}
        >
          <Trash2 size={18} color={neutralColors.error} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  ), [stickers, formatDate, handleDeleteSticker, handleReorderSticker, handleEditSticker]);



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
        {onBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={24} color={neutralColors.text.primary} />
          </TouchableOpacity>
        )}
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Your Memories</Text>
          <Text style={styles.subtitle}>
            {stickers.length} {stickers.length === 1 ? 'sticker' : 'stickers'}
          </Text>
        </View>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {stickers.map(renderStickerCard)}
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
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: neutralColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: neutralColors.text.primary,
    marginBottom: 4,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 15,
    color: neutralColors.text.secondary,
    fontWeight: '400' as const,
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
    gap: ITEM_GAP,
  },
  stickerCard: {
    width: ITEM_WIDTH,
    backgroundColor: neutralColors.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  stickerImageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: neutralColors.gray50,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  stickerImage: {
    width: '100%',
    height: '100%',
    padding: 12,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dateText: {
    fontSize: 11,
    color: neutralColors.white,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: neutralColors.gray50,
    justifyContent: 'center',
    alignItems: 'center',
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