import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshCw, Upload, ArrowRight, Sparkles, Edit3, ChevronLeft, ChevronRight, Grid3X3 } from 'lucide-react-native';
import { neutralColors } from '@/constants/colors';
import { useLocalSearchParams, router } from 'expo-router';
import { useUser } from '@/contexts/UserContext';


type ImageEditRequest = {
  prompt: string;
  images: { type: 'image'; image: string }[];
};

type ImageEditResponse = {
  image: { base64Data: string; mimeType: string };
};

const { width: screenWidth } = Dimensions.get('window');

export default function ReviewScreen() {
  const { saveSticker } = useUser();
  const params = useLocalSearchParams();
  
  // Safely extract params with type checking
  const originalImage = typeof params.originalImage === 'string' ? params.originalImage : '';
  const generatedStickers = typeof params.generatedStickers === 'string' ? params.generatedStickers : '';
  const isCustomGenerated = typeof params.isCustomGenerated === 'string' ? params.isCustomGenerated : undefined;
  const customPrompt = typeof params.customPrompt === 'string' ? params.customPrompt : undefined;
  const isProcessing = params.isProcessing === 'true';
  const processingError = typeof params.processingError === 'string' ? params.processingError : undefined;

  React.useEffect(() => {
    if (customPrompt) {
      setOriginalPrompt(customPrompt);
    }
  }, [customPrompt]);

  // Handle dynamic updates from processing
  useEffect(() => {
    if (params.generatedStickers && typeof params.generatedStickers === 'string' && params.generatedStickers !== '') {
      if (params.isProcessing !== 'true') {
        if (isCustomGenerated === 'true') {
          setStickerVersions([params.generatedStickers]);
        } else {
          // For photo-based, keep original as version 0
          const versions = [];
          if (originalImage) versions.push(originalImage);
          versions.push(params.generatedStickers);
          setStickerVersions(versions);
          // Always show the generated sticker (last version)
          setCurrentVersionIndex(versions.length - 1);
        }
        setIsLoadingSticker(false);
      }
    }
    if (params.isProcessing === 'true') {
      setIsLoadingSticker(true);
    } else if (params.isProcessing === 'false') {
      setIsLoadingSticker(false);
    }
    if (params.processingError && typeof params.processingError === 'string') {
      setLoadError(params.processingError);
      setIsLoadingSticker(false);
    }
  }, [params.generatedStickers, params.isProcessing, params.processingError]);

  const isCustom = isCustomGenerated === 'true';

  // Initialize with original image as version 0 for photo-based stickers
  const initialVersions = React.useMemo(() => {
    if (isCustomGenerated === 'true') {
      return generatedStickers ? [generatedStickers] : [];
    } else {
      // For photo-based stickers, include original as version 0
      const versions = [];
      if (originalImage) versions.push(originalImage);
      if (generatedStickers) versions.push(generatedStickers);
      return versions;
    }
  }, [originalImage, generatedStickers, isCustomGenerated]);
  
  const [stickerVersions, setStickerVersions] = useState<string[]>(initialVersions);
  // Always start with the latest version (sticker, not original photo)
  const [currentVersionIndex, setCurrentVersionIndex] = useState<number>(
    stickerVersions.length > 0 ? stickerVersions.length - 1 : 0
  );
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editPrompt, setEditPrompt] = useState<string>('');
  const [showEditInput, setShowEditInput] = useState<boolean>(false);
  const [originalPrompt, setOriginalPrompt] = useState<string>('');
  const [isLoadingSticker, setIsLoadingSticker] = useState<boolean>(isProcessing);
  const [loadError, setLoadError] = useState<string | undefined>(processingError);
  const flatListRef = useRef<FlatList>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  
  const currentStickers = stickerVersions[currentVersionIndex] || generatedStickers;

  const regenerateWithRetry = async (base64Data: string, retryCount: number = 0): Promise<ImageEditResponse> => {
    const maxRetries = 2;
    const timeout = 60000; // 60 seconds
    
    // Use the same prompt as initial generation for consistency
    const requestBody: ImageEditRequest = {
      prompt: 'Carefully analyze this photo and identify ALL prominent objects, people, animals, and distinctive elements. For each subject, create an accurate kiss-cut sticker design that closely matches the original appearance while optimizing for Printful printing. CRITICAL REQUIREMENTS: 1) COMPLETELY TRANSPARENT BACKGROUND - remove all background elements and make the background fully transparent (PNG format with alpha channel), 2) PRESERVE the exact colors, patterns, textures, and distinctive features of each subject from the original photo, 3) Maintain accurate proportions, poses, and spatial relationships between elements, 4) Keep recognizable details like facial features, clothing patterns, logos, text, or unique markings, 5) Use the actual color palette from the photo - do not change or stylize colors unless necessary for print quality, 6) Create clean vector-style edges with smooth curves around the subject, 7) CENTER the main subject PERFECTLY in the image frame with equal padding on all sides - the subject should be in the exact center both horizontally and vertically, 8) Add minimum 0.125 inch (3mm) bleed area around each design, 9) Avoid fine details smaller than 0.1 inch but preserve character-defining features, 10) Use bold, clear outlines while maintaining subject accuracy, 11) Ensure designs work at 3x3 inch minimum size, 12) Make the subject fill approximately 85-90% of the frame for optimal viewing and consistent sizing. The goal is photographic accuracy transformed into perfectly centered, transparent sticker format with the subject filling most of the frame.',
      images: [{ type: 'image', image: base64Data }],
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log(`Sending regeneration request to AI API (attempt ${retryCount + 1}/${maxRetries + 1})...`);
      
      const response = await fetch('https://toolkit.rork.com/images/edit/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 504 && retryCount < maxRetries) {
          console.log(`Regeneration timed out (504), retrying in ${(retryCount + 1) * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
          return regenerateWithRetry(base64Data, retryCount + 1);
        }
        throw new Error(`API request failed: ${response.status}`);
      }

      const data: ImageEditResponse = await response.json();
      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        if (retryCount < maxRetries) {
          console.log(`Regeneration timed out, retrying in ${(retryCount + 1) * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
          return regenerateWithRetry(base64Data, retryCount + 1);
        }
        throw new Error('Request timed out after multiple attempts');
      }
      
      if (retryCount < maxRetries && (error.message.includes('504') || error.message.includes('timeout'))) {
        console.log(`Regeneration error occurred, retrying in ${(retryCount + 1) * 2} seconds...`);
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
        return regenerateWithRetry(base64Data, retryCount + 1);
      }
      
      throw error;
    }
  };

  const regenerateStickers = async () => {
    setIsRegenerating(true);
    console.log('Regenerating stickers...');

    try {
      if (isCustom) {
        // For custom stickers, regenerate using Gemini Flash with the original prompt
        const regeneratePrompt = originalPrompt || 'Create a high-quality kiss-cut sticker design with vibrant colors and clean edges, optimized for printing.';
        
        // Create a simple white canvas as base image for Gemini to work with
        let base64Data: string;
        
        if (Platform.OS === 'web') {
          const canvas = document.createElement('canvas');
          canvas.width = 1024;
          canvas.height = 1024;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 1024, 1024);
          }
          const whiteCanvasDataUrl = canvas.toDataURL('image/png');
          base64Data = whiteCanvasDataUrl.split(',')[1];
        } else {
          // For mobile, create a simple base64 encoded white PNG
          // This is a minimal 1x1 white PNG in base64
          base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
        }

        // Use the same prompt structure as initial generation for consistency
        const requestBody: ImageEditRequest = {
          prompt: `Create a completely new high-quality kiss-cut sticker design based on this description: "${regeneratePrompt}". IGNORE the white background image provided - this is just a placeholder. Create an entirely new design from scratch. REQUIREMENTS: 1) COMPLETELY TRANSPARENT BACKGROUND - no background elements, fully transparent PNG with alpha channel, 2) Design should be optimized for Printful kiss-cut sticker printing, 3) Use vibrant, bold colors that will print well, 4) Create clean vector-style artwork with smooth edges, 5) CENTER the main subject PERFECTLY in the image frame with equal padding on all sides - the subject should be in the exact center both horizontally and vertically, 6) Add minimum 0.125 inch (3mm) bleed area around the design, 7) Avoid fine details smaller than 0.1 inch, 8) Use bold, clear outlines, 9) Ensure design works at 3x3 inch minimum size, 10) Make it visually appealing and memorable as a sticker, 11) Focus on the main subject with no background elements, 12) Make the subject fill approximately 85-90% of the frame for optimal viewing and consistent sizing. Generate a completely original design based on the text description with transparent background, perfectly centered and filling most of the frame.`,
          images: [{ type: 'image', image: base64Data }],
        };

        const response = await fetch('https://toolkit.rork.com/images/edit/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const data: ImageEditResponse = await response.json();
        const newSticker = `data:${data.image.mimeType};base64,${data.image.base64Data}`;
        const updatedVersions = [...stickerVersions, newSticker];
        setStickerVersions(updatedVersions);
        const newIndex = updatedVersions.length - 1;
        setCurrentVersionIndex(newIndex);
        
        // Save regenerated custom sticker to library
        try {
          await saveSticker(originalImage, newSticker, `Custom: ${originalPrompt.substring(0, 50)}${originalPrompt.length > 50 ? '...' : ''}`);
          console.log('Regenerated custom sticker saved to library');
        } catch (error) {
          console.error('Error saving regenerated sticker:', error);
        }
        
        // Scroll to new version with a slight delay
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ 
            index: newIndex, 
            animated: true 
          });
        }, 100);
      } else {
        // For photo-based stickers, use the existing regeneration logic
        let base64Data: string;
        if (originalImage.startsWith('data:')) {
          base64Data = originalImage.split(',')[1];
        } else {
          const response = await fetch(originalImage);
          const blob = await response.blob();
          const reader = new FileReader();
          base64Data = await new Promise((resolve) => {
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.readAsDataURL(blob);
          });
        }

        const data = await regenerateWithRetry(base64Data);
        const newSticker = `data:${data.image.mimeType};base64,${data.image.base64Data}`;
        const updatedVersions = [...stickerVersions, newSticker];
        setStickerVersions(updatedVersions);
        const newIndex = updatedVersions.length - 1;
        setCurrentVersionIndex(newIndex);
        
        // Save regenerated photo-based sticker to library
        try {
          await saveSticker(originalImage, newSticker, 'Memory Sticker');
          console.log('Regenerated sticker saved to library');
        } catch (error) {
          console.error('Error saving regenerated sticker:', error);
        }
        
        // Scroll to new version with a slight delay
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ 
            index: newIndex, 
            animated: true 
          });
        }, 100);
      }
      
      console.log('Sticker regeneration complete!');
    } catch (error: any) {
      console.error('Error regenerating stickers:', error);
      
      let errorMessage = 'Failed to regenerate stickers. Please try again.';
      if (error.message.includes('timeout')) {
        errorMessage = 'The request took too long to process. Please try again later.';
      } else if (error.message.includes('504')) {
        errorMessage = 'The server is temporarily overloaded. Please try again in a few moments.';
      }
      
      Alert.alert('Regeneration Error', errorMessage);
    } finally {
      setIsRegenerating(false);
    }
  };

  const navigateToVersion = (index: number) => {
    if (index >= 0 && index < stickerVersions.length) {
      setCurrentVersionIndex(index);
      flatListRef.current?.scrollToIndex({ 
        index, 
        animated: true 
      });
    }
  };

  const renderVersionItem = ({ item, index }: { item: string; index: number }) => {
    // Check if this is the original photo (version 0) for photo-based stickers
    const isOriginalPhoto = !isCustom && index === 0;
    
    return (
      <View style={styles.versionContainer}>
        {isOriginalPhoto && (
          <View style={styles.versionLabel}>
            <Text style={styles.versionLabelText}>Original Photo</Text>
          </View>
        )}
        <Image 
          source={{ uri: item }} 
          style={styles.versionImage}
        />
        {(isRegenerating || isEditing) && !isOriginalPhoto && (
          <View style={styles.regeneratingOverlay}>
            <ActivityIndicator size="large" color={neutralColors.primary} />
            <Text style={styles.regeneratingText}>
              {isRegenerating ? 'Regenerating...' : 'Editing...'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const proceedToCheckout = () => {
    if (!currentStickers || isLoadingSticker) return;
    
    // For photo-based stickers, ensure we're not on the original photo
    const stickerToShip = (!isCustom && currentVersionIndex === 0 && stickerVersions.length > 1) 
      ? stickerVersions[1] 
      : currentStickers;
    
    // Navigate immediately without any async operations
    router.push({
      pathname: '/checkout',
      params: {
        originalImage,
        finalStickers: stickerToShip,
      },
    });
    
    // Save sticker in background after navigation with even longer delay to avoid any blocking
    setTimeout(async () => {
      try {
        await saveSticker(originalImage, stickerToShip);
        console.log('Sticker saved successfully in background');
      } catch (error) {
        console.error('Error saving sticker in background:', error);
      }
    }, 1000);
  };

  const uploadNewPhoto = () => {
    router.back();
  };

  const editSticker = async () => {
    if (!editPrompt.trim()) {
      Alert.alert('Edit Instructions Required', 'Please describe what changes you want to make.');
      return;
    }

    setIsEditing(true);
    console.log('Editing sticker with prompt:', editPrompt);

    try {
      // Convert current sticker to base64 for editing
      let base64Data: string;
      if (currentStickers.startsWith('data:')) {
        base64Data = currentStickers.split(',')[1];
      } else {
        const response = await fetch(currentStickers);
        const blob = await response.blob();
        const reader = new FileReader();
        base64Data = await new Promise((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        });
      }

      const requestBody: ImageEditRequest = {
        prompt: `Edit this sticker design based on these instructions: "${editPrompt.trim()}". IMPORTANT: 1) Maintain the kiss-cut sticker format optimized for Printful printing, 2) Keep vibrant, bold colors that print well, 3) Preserve clean vector-style artwork with smooth edges, 4) Ensure transparent background (PNG format), 5) Maintain minimum 0.125 inch (3mm) bleed area, 6) Avoid fine details smaller than 0.1 inch, 7) Keep bold, clear outlines, 8) Ensure design still works at 3x3 inch minimum size, 9) Make the requested changes while keeping it visually appealing as a sticker.`,
        images: [{ type: 'image', image: base64Data }],
      };

      const response = await fetch('https://toolkit.rork.com/images/edit/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data: ImageEditResponse = await response.json();
      const newSticker = `data:${data.image.mimeType};base64,${data.image.base64Data}`;
      const updatedVersions = [...stickerVersions, newSticker];
      setStickerVersions(updatedVersions);
      const newIndex = updatedVersions.length - 1;
      setCurrentVersionIndex(newIndex);
      setEditPrompt('');
      setShowEditInput(false);
      
      // Save edited sticker to library
      try {
        const titlePrefix = isCustom ? 'Custom' : 'Memory Sticker';
        const editTitle = editPrompt.trim() ? `${titlePrefix}: ${editPrompt.substring(0, 50)}${editPrompt.length > 50 ? '...' : ''}` : titlePrefix;
        await saveSticker(originalImage, newSticker, editTitle);
        console.log('Edited sticker saved to library');
      } catch (error) {
        console.error('Error saving edited sticker:', error);
      }
      
      // Scroll to new version with a slight delay
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ 
          index: newIndex, 
          animated: true 
        });
      }, 100);
      console.log('Sticker editing complete!');
    } catch (error: any) {
      console.error('Error editing sticker:', error);
      
      let errorMessage = 'Failed to edit sticker. Please try again.';
      if (error.message.includes('timeout')) {
        errorMessage = 'The request took too long to process. Please try again later.';
      } else if (error.message.includes('504')) {
        errorMessage = 'The server is temporarily overloaded. Please try again in a few moments.';
      }
      
      Alert.alert('Edit Error', errorMessage);
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
        >
          <ScrollView 
            ref={scrollViewRef}
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {isCustom ? 'Review Your Custom Sticker' : 'Review Your Memory'}
              </Text>
              <Text style={styles.subtitle}>
                {isCustom 
                  ? 'Your custom AI-generated sticker is ready for your planner'
                  : 'Your memory stickers are ready for your planner'
                }
              </Text>
            </View>

            {loadError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorTitle}>Processing Error</Text>
                <Text style={styles.errorMessage}>{loadError}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => router.back()}
                >
                  <Text style={styles.retryButtonText}>Go Back</Text>
                </TouchableOpacity>
              </View>
            ) : isLoadingSticker ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={neutralColors.primary} />
                <Text style={styles.loadingTitle}>Creating Your Stickers</Text>
                <Text style={styles.loadingSubtext}>This may take a moment...</Text>
              </View>
            ) : isCustom ? (
              <View style={styles.singleStickerContainer}>
                <View style={styles.stickerHeaderContainer}>
                  <Text style={styles.sectionTitle}>Custom Sticker</Text>
                  {stickerVersions.length > 1 && (
                    <View style={styles.versionIndicator}>
                      <Text style={styles.versionText}>
                        {currentVersionIndex + 1} of {stickerVersions.length}
                      </Text>
                      <Text style={styles.swipeHint}>Swipe to compare</Text>
                    </View>
                  )}
                </View>
                <View style={styles.galleryContainer}>
                  <FlatList
                    ref={flatListRef}
                    data={stickerVersions}
                    renderItem={renderVersionItem}
                    keyExtractor={(item, index) => `sticker-${index}`}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    snapToInterval={screenWidth - 48}
                    snapToAlignment="center"
                    bounces={false}
                    scrollEventThrottle={16}
                    onScroll={(event) => {
                      const index = Math.round(event.nativeEvent.contentOffset.x / (screenWidth - 48));
                      if (index !== currentVersionIndex && index >= 0 && index < stickerVersions.length) {
                        setCurrentVersionIndex(index);
                      }
                    }}
                    getItemLayout={(data, index) => ({
                      length: screenWidth - 48,
                      offset: (screenWidth - 48) * index,
                      index,
                    })}
                  />
                  
                  {/* Navigation Arrows */}
                  {stickerVersions.length > 1 && (
                    <>
                      {currentVersionIndex > 0 && (
                        <TouchableOpacity
                          style={[styles.navArrow, styles.navArrowLeft]}
                          onPress={() => navigateToVersion(currentVersionIndex - 1)}
                        >
                          <ChevronLeft size={24} color={neutralColors.white} />
                        </TouchableOpacity>
                      )}
                      {currentVersionIndex < stickerVersions.length - 1 && (
                        <TouchableOpacity
                          style={[styles.navArrow, styles.navArrowRight]}
                          onPress={() => navigateToVersion(currentVersionIndex + 1)}
                        >
                          <ChevronRight size={24} color={neutralColors.white} />
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                  
                  {/* Version Indicator */}
                  {stickerVersions.length > 1 && (
                    <View style={styles.versionIndicatorOverlay}>
                      <Text style={styles.versionIndicatorText}>
                        {currentVersionIndex + 1} of {stickerVersions.length}
                      </Text>
                    </View>
                  )}
                </View>
                
                {/* Version Dots */}
                {stickerVersions.length > 1 && (
                  <View style={styles.versionDots}>
                    {stickerVersions.map((_, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.versionDot,
                          index === currentVersionIndex && styles.versionDotActive,
                        ]}
                        onPress={() => navigateToVersion(index)}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.comparisonContainer}>
                <View style={styles.imageSection}>
                  <View style={styles.stickerHeaderContainer}>
                    <Text style={styles.sectionTitle}>Memory Stickers</Text>
                    {stickerVersions.length > 1 && (
                      <View style={styles.versionIndicator}>
                        <Text style={styles.versionText}>
                          Version {currentVersionIndex === 0 ? '1' : currentVersionIndex} of {stickerVersions.length - 1}
                        </Text>
                        <Text style={styles.swipeHint}>
                          {currentVersionIndex === 0 ? 'Original photo' : 'Swipe to see original'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.galleryContainer}>
                    <FlatList
                      ref={flatListRef}
                      data={stickerVersions}
                      renderItem={renderVersionItem}
                      keyExtractor={(item, index) => `sticker-${index}`}
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      snapToInterval={screenWidth - 48}
                      snapToAlignment="center"
                      bounces={false}
                      scrollEventThrottle={16}
                      initialScrollIndex={stickerVersions.length > 1 ? 1 : 0}
                      onScroll={(event) => {
                        const index = Math.round(event.nativeEvent.contentOffset.x / (screenWidth - 48));
                        if (index !== currentVersionIndex && index >= 0 && index < stickerVersions.length) {
                          setCurrentVersionIndex(index);
                        }
                      }}
                      getItemLayout={(data, index) => ({
                        length: screenWidth - 48,
                        offset: (screenWidth - 48) * index,
                        index,
                      })}
                    />
                    
                    {/* Navigation Arrows */}
                    {stickerVersions.length > 1 && (
                      <>
                        {currentVersionIndex > 0 && (
                          <TouchableOpacity
                            style={[styles.navArrow, styles.navArrowLeft]}
                            onPress={() => navigateToVersion(currentVersionIndex - 1)}
                          >
                            <ChevronLeft size={24} color={neutralColors.white} />
                          </TouchableOpacity>
                        )}
                        {currentVersionIndex < stickerVersions.length - 1 && (
                          <TouchableOpacity
                            style={[styles.navArrow, styles.navArrowRight]}
                            onPress={() => navigateToVersion(currentVersionIndex + 1)}
                          >
                            <ChevronRight size={24} color={neutralColors.white} />
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                    
                    {/* Version Indicator */}
                    {stickerVersions.length > 1 && (
                      <View style={styles.versionIndicatorOverlay}>
                        <Text style={styles.versionIndicatorText}>
                          {currentVersionIndex === 0 ? 'Original' : `Version ${currentVersionIndex}`}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Version Dots */}
                  {stickerVersions.length > 1 && (
                    <View style={styles.versionDots}>
                      {stickerVersions.map((_, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.versionDot,
                            index === currentVersionIndex && styles.versionDotActive,
                          ]}
                          onPress={() => navigateToVersion(index)}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

            {showEditInput && (
              <View style={[styles.editContainer, { marginBottom: 32 }]}>
                <Text style={styles.editLabel}>Describe the changes you want to make:</Text>
                <View style={styles.editInputContainer}>
                  <TextInput
                    style={styles.editInput}
                    placeholder="e.g., 'make it more colorful', 'add a smile', 'change background to blue'"
                    placeholderTextColor={neutralColors.text.secondary}
                    value={editPrompt}
                    onChangeText={setEditPrompt}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    editable={!isEditing}
                    selectionColor={neutralColors.primary}
                    underlineColorAndroid="transparent"
                    autoCorrect={false}
                    spellCheck={false}
                    autoFocus={true}
                  />
                </View>
                <View style={styles.editButtonContainer}>
                  <TouchableOpacity
                    style={styles.cancelEditButton}
                    onPress={() => {
                      setShowEditInput(false);
                      setEditPrompt('');
                    }}
                    disabled={isEditing}
                  >
                    <Text style={styles.cancelEditButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.applyEditButton, (!editPrompt.trim() || isEditing) && styles.buttonDisabled]}
                    onPress={editSticker}
                    disabled={!editPrompt.trim() || isEditing}
                  >
                    {isEditing ? (
                      <>
                        <ActivityIndicator size="small" color={neutralColors.white} />
                        <Text style={styles.applyEditButtonText}>Editing...</Text>
                      </>
                    ) : (
                      <>
                        <Edit3 size={16} color={neutralColors.white} />
                        <Text style={styles.applyEditButtonText}>Apply Changes</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, (isRegenerating || isEditing) && styles.buttonDisabled]}
                onPress={regenerateStickers}
                disabled={isRegenerating || isEditing}
              >
                <RefreshCw size={18} color={neutralColors.primary} />
                <Text style={styles.actionButtonText}>Regenerate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, (isRegenerating || isEditing) && styles.buttonDisabled]}
                onPress={() => {
                  setShowEditInput(!showEditInput);
                  if (!showEditInput) {
                    // Scroll to edit input when opening
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                  }
                }}
                disabled={isRegenerating || isEditing}
              >
                <Edit3 size={18} color={neutralColors.primary} />
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonNew]}
                onPress={uploadNewPhoto}
                disabled={isRegenerating || isEditing}
              >
                <Upload size={18} color={neutralColors.white} />
                <Text style={[styles.actionButtonText, styles.actionButtonTextNew]}>
                  {isCustom ? 'New' : 'New'}
                </Text>
              </TouchableOpacity>
            </View>

            {!loadError && !isLoadingSticker && (
              <>
                <TouchableOpacity
                  style={[styles.multiStickerButton, (isRegenerating || isEditing || !currentStickers) && styles.buttonDisabled]}
                  onPress={() => {
                    const stickerToUse = (!isCustom && currentVersionIndex === 0 && stickerVersions.length > 1) 
                      ? stickerVersions[1] 
                      : currentStickers;
                    router.push({
                      pathname: '/sheet-size-selection',
                      params: {
                        stickerImage: stickerToUse,
                        originalImage,
                      },
                    });
                  }}
                  disabled={isRegenerating || isEditing || !currentStickers}
                >
                  <Grid3X3 size={20} color={neutralColors.primary} />
                  <Text style={styles.multiStickerButtonText}>
                    Create Mini Sticker Sheet
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.checkoutButton, (isRegenerating || isEditing || !currentStickers) && styles.buttonDisabled]}
                  onPress={proceedToCheckout}
                  disabled={isRegenerating || isEditing || !currentStickers}
                >
                  <Sparkles size={20} color={neutralColors.white} />
                  <Text style={styles.checkoutButtonText}>
                    {isCustom ? 'Ship Single Sticker' : 'Ship Single Sticker'}
                  </Text>
                  <ArrowRight size={20} color={neutralColors.white} />
                </TouchableOpacity>
              </>
            )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: neutralColors.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: neutralColors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    color: neutralColors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  comparisonContainer: {
    marginBottom: 32,
  },
  singleStickerContainer: {
    marginBottom: 32,
  },
  imageSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  originalImageContainer: {
    backgroundColor: neutralColors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: neutralColors.border,
  },
  originalImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  galleryContainer: {
    height: 400,
    backgroundColor: neutralColors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: neutralColors.border,
    position: 'relative',
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  versionContainer: {
    width: screenWidth - 48,
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: neutralColors.white,
    padding: 20,
  },
  versionImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navArrowLeft: {
    left: 12,
  },
  navArrowRight: {
    right: 12,
  },
  versionIndicatorOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  versionIndicatorText: {
    color: neutralColors.white,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  regeneratingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  regeneratingText: {
    color: neutralColors.text.primary,
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  actionButton: {
    flex: 1,
    backgroundColor: neutralColors.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: neutralColors.border,
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  actionButtonIcon: {
    // Removed separate icon container styles
  },
  actionButtonText: {
    color: neutralColors.text.primary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  actionButtonNew: {
    backgroundColor: neutralColors.primary,
    borderColor: neutralColors.primary,
  },
  actionButtonIconNew: {
    // Removed separate icon container styles
  },
  actionButtonTextNew: {
    color: neutralColors.white,
  },
  checkoutButton: {
    backgroundColor: neutralColors.gray900,
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    marginHorizontal: 4,
  },
  checkoutButtonText: {
    color: neutralColors.white,
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  multiStickerButton: {
    backgroundColor: neutralColors.white,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: neutralColors.primary,
    marginBottom: 16,
    marginHorizontal: 4,
  },
  multiStickerButtonText: {
    color: neutralColors.primary,
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  editContainer: {
    backgroundColor: neutralColors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: neutralColors.border,
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  editLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
    marginBottom: 12,
  },
  editInputContainer: {
    backgroundColor: neutralColors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: neutralColors.border,
    marginBottom: 16,
  },
  editInput: {
    padding: 16,
    fontSize: 15,
    color: neutralColors.text.primary,
    backgroundColor: 'transparent',
    lineHeight: 20,
    minHeight: 100,
    maxHeight: 150,
    textAlignVertical: 'top',
    includeFontPadding: false,
  },
  editButtonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelEditButton: {
    flex: 1,
    backgroundColor: neutralColors.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: neutralColors.border,
  },
  cancelEditButtonText: {
    color: neutralColors.text.secondary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  applyEditButton: {
    flex: 2,
    backgroundColor: neutralColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  applyEditButtonText: {
    color: neutralColors.white,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  stickerHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  versionIndicator: {
    alignItems: 'flex-end',
  },
  versionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: neutralColors.primary,
    marginBottom: 2,
  },
  swipeHint: {
    fontSize: 12,
    color: neutralColors.text.secondary,
    fontStyle: 'italic',
  },

  versionDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  versionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: neutralColors.border,
  },
  versionDotActive: {
    backgroundColor: neutralColors.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  versionLabel: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 1,
  },
  versionLabelText: {
    color: neutralColors.white,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  loadingContainer: {
    backgroundColor: neutralColors.surface,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center' as const,
    marginVertical: 60,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
    marginTop: 20,
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: neutralColors.text.secondary,
  },
  errorContainer: {
    backgroundColor: neutralColors.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center' as const,
    marginVertical: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FF4444',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: neutralColors.text.secondary,
    textAlign: 'center' as const,
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: neutralColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryButtonText: {
    color: neutralColors.white,
    fontSize: 15,
    fontWeight: '600' as const,
  },
});