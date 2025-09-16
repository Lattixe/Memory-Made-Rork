import React, { useState } from 'react';
import {
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';

interface ZoomableImageProps {
  source: { uri: string };
  style?: any;
  onPress?: () => void;
  maxZoom?: number;
  minZoom?: number;
}

export default function ZoomableImage({ 
  source, 
  style, 
  onPress, 
  maxZoom = 4, 
  minZoom = 1 
}: ZoomableImageProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const containerWidth = screenWidth - 96; // Account for padding
  const containerHeight = 350; // Fixed height for sticker preview

  const handleSingleTap = () => {
    if (onPress) {
      onPress();
    }
  };

  const handleImageLoad = (event: any) => {
    const { width, height } = event.nativeEvent.source;
    
    // Calculate the best fit size while maintaining aspect ratio
    const aspectRatio = width / height;
    let finalWidth = containerWidth;
    let finalHeight = containerWidth / aspectRatio;
    
    // If height exceeds container, scale based on height instead
    if (finalHeight > containerHeight) {
      finalHeight = containerHeight;
      finalWidth = containerHeight * aspectRatio;
    }
    
    // Ensure minimum size for visibility
    const scale = Math.max(0.8, Math.min(finalWidth / containerWidth, finalHeight / containerHeight));
    finalWidth = finalWidth * scale;
    finalHeight = finalHeight * scale;
    
    setImageSize({ width: finalWidth, height: finalHeight });
  };

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        maximumZoomScale={maxZoom}
        minimumZoomScale={minZoom}
        zoomScale={minZoom}
        bouncesZoom={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        centerContent={true}
        pinchGestureEnabled={true}
        scrollEnabled={true}
        directionalLockEnabled={false}
      >
        <TouchableOpacity 
          activeOpacity={1}
          onPress={handleSingleTap}
          style={styles.imageContainer}
        >
          <Image 
            source={source} 
            style={[
              styles.image,
              imageSize.width > 0 && imageSize.height > 0 ? {
                width: imageSize.width,
                height: imageSize.height,
              } : {
                width: containerWidth * 0.8,
                height: containerHeight * 0.8,
              }
            ]}
            resizeMode="contain"
            onLoad={handleImageLoad}
          />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100%',
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  image: {
    // Dynamic sizing handled in component
  },
});