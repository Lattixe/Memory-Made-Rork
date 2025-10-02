import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  FlatList,
  StatusBar,
} from 'react-native';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { neutralColors } from '@/constants/colors';
import { SavedSticker } from '@/contexts/UserContext';
import ZoomableImage from './ZoomableImage';

interface ImageGalleryModalProps {
  visible: boolean;
  stickers: SavedSticker[];
  initialIndex: number;
  onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function ImageGalleryModal({ 
  visible, 
  stickers, 
  initialIndex, 
  onClose 
}: ImageGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [showControls, setShowControls] = useState<boolean>(true);
  const flatListRef = useRef<FlatList>(null);

  // Update current index when initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  const navigateToImage = (index: number) => {
    if (index >= 0 && index < stickers.length) {
      setCurrentIndex(index);
      flatListRef.current?.scrollToIndex({ 
        index, 
        animated: true 
      });
    }
  };

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / screenWidth);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < stickers.length) {
      setCurrentIndex(newIndex);
    }
  };

  const renderStickerItem = ({ item }: { item: any }) => (
    <View style={styles.imageWrapper}>
      <ZoomableImage 
        source={{ uri: item.stickerImage }} 
        style={styles.zoomableContainer}
        onPress={toggleControls}
        maxZoom={4}
        minZoom={1}
        fullScreen
      />
    </View>
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!visible || stickers.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar hidden={!showControls} />
      <View style={styles.container}>
        {/* Header */}
        {showControls && (
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color={neutralColors.white} />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>Memory Stickers</Text>
              <Text style={styles.headerSubtitle}>
                {currentIndex + 1} of {stickers.length}
              </Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>
        )}

        {/* Image Gallery */}
        <View style={styles.imageContainer}>
          <FlatList
            ref={flatListRef}
            data={stickers}
            renderItem={renderStickerItem}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={screenWidth}
            snapToAlignment="start"
            bounces={false}
            scrollEventThrottle={16}
            onScroll={handleScroll}
            initialScrollIndex={initialIndex}
            getItemLayout={(data, index) => ({
              length: screenWidth,
              offset: screenWidth * index,
              index,
            })}
          />
        </View>

        {/* Navigation Arrows */}
        {showControls && stickers.length > 1 && (
          <>
            {currentIndex > 0 && (
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonLeft]}
                onPress={() => navigateToImage(currentIndex - 1)}
              >
                <ChevronLeft size={32} color={neutralColors.white} />
              </TouchableOpacity>
            )}
            {currentIndex < stickers.length - 1 && (
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonRight]}
                onPress={() => navigateToImage(currentIndex + 1)}
              >
                <ChevronRight size={32} color={neutralColors.white} />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Footer */}
        {showControls && (
          <View style={styles.footer}>
            <Text style={styles.footerDate}>
              {formatDate(stickers[currentIndex].createdAt)}
            </Text>
            {stickers.length > 1 && (
              <View style={styles.pagination}>
                {stickers.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.paginationDot,
                      index === currentIndex && styles.paginationDotActive,
                    ]}
                    onPress={() => navigateToImage(index)}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: neutralColors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 2,
  },
  headerSpacer: {
    width: 44,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: neutralColors.white,
  },
  imageWrapper: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomableContainer: {
    flex: 1,
    width: screenWidth,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navButtonLeft: {
    left: 20,
  },
  navButtonRight: {
    right: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    zIndex: 10,
  },
  footerDate: {
    color: neutralColors.white,
    fontSize: 16,
    fontWeight: '500' as const,
    marginBottom: 16,
    textAlign: 'center',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  paginationDotActive: {
    backgroundColor: neutralColors.white,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});