import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Trash2, ShoppingCart, Calendar, Edit3, ArrowLeft } from 'lucide-react-native';
import { neutralColors } from '@/constants/colors';
import { SavedSticker } from '@/contexts/UserContext';
import { router } from 'expo-router';
import ImageGalleryModal from './ImageGalleryModal';
import ZoomableImage from './ZoomableImage';


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
    // Pass the sticker data directly for instant navigation
    router.push({
      pathname: '/checkout',
      params: {
        stickerId: sticker.id,
        originalImage: sticker.originalImage,
        finalStickers: sticker.stickerImage,
        isReorder: 'true',
      },
    });
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
        activeOpacity={0.9}
      >
        <ZoomableImage 
          source={{ uri: item.stickerImage }} 
          style={styles.stickerImage}
          maxZoom={3}
          minZoom={1}
        />
      </TouchableOpacity>
      
      <View style={styles.stickerInfo}>
        <View style={styles.dateContainer}>
          <Calendar size={14} color={neutralColors.text.secondary} />
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.reorderButton}
            onPress={() => handleReorderSticker(item)}
            activeOpacity={0.7}
          >
            <ShoppingCart size={16} color={neutralColors.primary} />
            <Text style={styles.reorderButtonText}>Reorder</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditSticker(item)}
            activeOpacity={0.7}
          >
            <Edit3 size={16} color={neutralColors.white} />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteSticker(item)}
            activeOpacity={0.7}
          >
            <Trash2 size={16} color={neutralColors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ), [stickers, formatDate, handleDeleteSticker, handleReorderSticker, handleEditSticker]);

  const stickerRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < stickers.length; i += 2) {
      rows.push(stickers.slice(i, i + 2));
    }
    return rows;
  }, [stickers]);

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
        <View style={styles.headerTop}>
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
              {`${stickers.length} saved memory sticker${stickers.length !== 1 ? 's' : ''}`}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.gridContainer}>
        {stickerRows.map((rowItems, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {rowItems.map(renderStickerCard)}
            {rowItems.length === 1 && <View style={styles.emptyPlaceholder} />}
          </View>
        ))}
      </View>

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
  },
  header: {
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  backButton: {
    marginTop: 2,
    padding: 8,
    marginLeft: -8,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: neutralColors.text.primary,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: neutralColors.text.secondary,
  },
  gridContainer: {
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stickerCard: {
    flex: 1,
    backgroundColor: neutralColors.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: neutralColors.border,
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 200,
  },
  stickerImageContainer: {
    aspectRatio: 1,
    backgroundColor: neutralColors.white,
  },
  stickerImage: {
    width: '100%',
    height: '100%',
  },
  stickerInfo: {
    padding: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 13,
    color: neutralColors.text.secondary,
    fontWeight: '500' as const,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: neutralColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flex: 1,
    marginRight: 6,
  },
  reorderButtonText: {
    fontSize: 13,
    color: neutralColors.primary,
    fontWeight: '600' as const,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: neutralColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 6,
    minWidth: 60,
    justifyContent: 'center',
    shadowColor: neutralColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  editButtonText: {
    fontSize: 13,
    color: neutralColors.white,
    fontWeight: '600' as const,
  },

  deleteButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: neutralColors.surface,
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
  emptyPlaceholder: {
    flex: 1,
    marginHorizontal: 4,
  },
});