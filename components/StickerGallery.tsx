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
const CARD_PADDING = 16;
const CARD_GAP = 12;
const CARD_WIDTH = (screenWidth - (CARD_PADDING * 2) - CARD_GAP) / 2;


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
      </TouchableOpacity>
      
      <View style={styles.stickerInfo}>
        <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditSticker(item)}
            activeOpacity={0.7}
          >
            <Edit3 size={16} color={neutralColors.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleReorderSticker(item)}
            activeOpacity={0.7}
          >
            <ShoppingCart size={16} color={neutralColors.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteSticker(item)}
            activeOpacity={0.7}
          >
            <Trash2 size={16} color={neutralColors.error} />
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: CARD_PADDING,
    paddingTop: 8,
    paddingBottom: 20,
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
    fontSize: 28,
    fontWeight: '700' as const,
    color: neutralColors.text.primary,
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: neutralColors.text.secondary,
    fontWeight: '500' as const,
  },
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    paddingHorizontal: CARD_PADDING,
    paddingBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  stickerCard: {
    width: CARD_WIDTH,
    backgroundColor: neutralColors.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  stickerImageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: neutralColors.gray50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerImage: {
    width: '90%',
    height: '90%',
  },
  stickerInfo: {
    padding: 12,
    gap: 10,
  },
  dateText: {
    fontSize: 12,
    color: neutralColors.text.secondary,
    fontWeight: '500' as const,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: neutralColors.gray50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: neutralColors.border,
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