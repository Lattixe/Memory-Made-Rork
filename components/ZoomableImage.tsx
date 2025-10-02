import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';

interface ZoomableImageProps {
  source: { uri: string };
  style?: object;
  onPress?: () => void;
  maxZoom?: number;
  minZoom?: number;
  testID?: string;
  fullScreen?: boolean;
}

export default function ZoomableImage({
  source,
  style,
  onPress,
  maxZoom = 4,
  minZoom = 1,
  testID,
  fullScreen = false,
}: ZoomableImageProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  const containerWidth = useMemo(() => fullScreen ? screenWidth : Math.max(0, screenWidth - 96), [screenWidth, fullScreen]);
  const containerHeight = useMemo(() => fullScreen ? screenHeight * 0.7 : 350, [screenHeight, fullScreen]);

  const handleSingleTap = useCallback(() => {
    if (onPress) onPress();
  }, [onPress]);

  const computeFitSize = useCallback(
    (naturalWidth: number, naturalHeight: number) => {
      const aspectRatio = naturalWidth / naturalHeight;
      let finalWidth = containerWidth;
      let finalHeight = containerWidth / aspectRatio;

      if (finalHeight > containerHeight) {
        finalHeight = containerHeight;
        finalWidth = containerHeight * aspectRatio;
      }

      const scale = Math.max(
        0.8,
        Math.min(finalWidth / containerWidth, finalHeight / containerHeight),
      );
      return { width: finalWidth * scale, height: finalHeight * scale };
    },
    [containerWidth, containerHeight],
  );

  const handleImageLoad = useCallback(() => {
    const uri = source?.uri ?? '';
    if (!uri) {
      console.warn('ZoomableImage: source.uri is empty');
      setImageSize({ width: containerWidth * 0.8, height: containerHeight * 0.8 });
      return;
    }

    Image.getSize(
      uri,
      (w: number, h: number) => {
        const fitted = computeFitSize(w, h);
        setImageSize(fitted);
      },
      (err: unknown) => {
        console.error('ZoomableImage: failed to get image size', err);
        setImageSize({ width: containerWidth * 0.8, height: containerHeight * 0.8 });
      },
    );
  }, [source?.uri, containerWidth, containerHeight, computeFitSize]);

  const scrollContentStyle = useMemo(
    () => [
      styles.scrollContent,
      { minHeight: containerHeight },
    ],
    [containerHeight],
  );

  return (
    <View style={[styles.container, style]} testID={testID ?? 'zoomable-image-container'}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={scrollContentStyle}
        maximumZoomScale={maxZoom}
        minimumZoomScale={minZoom}
        bouncesZoom
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        pinchGestureEnabled={Platform.OS !== 'web'}
        scrollEnabled
        directionalLockEnabled={false}
        testID="zoomable-image-scroll"
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleSingleTap}
          style={styles.imageContainer}
          testID="zoomable-image-touchable"
        >
          <Image
            source={source}
            style={[
              imageSize
                ? { width: imageSize.width, height: imageSize.height }
                : { width: containerWidth * 0.8, height: containerHeight * 0.8 },
            ]}
            resizeMode="contain"
            onLoad={handleImageLoad}
            onError={() => {
              console.error('ZoomableImage: image failed to load');
              setImageSize({ width: containerWidth * 0.8, height: containerHeight * 0.8 });
            }}
            testID="zoomable-image-img"
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
});