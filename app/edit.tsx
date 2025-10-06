import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Save, Sparkles, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { neutralColors } from '@/constants/colors';
import { router, useLocalSearchParams } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { safeJsonParse } from '@/utils/json';
import { compressBase64Image, estimateBase64Size } from '@/utils/imageCompression';
import { processStickerImage } from '@/utils/backgroundRemover';
import { getEditPrompt } from '@/utils/promptManager';
import { callImageEditApi } from '@/utils/imageEditApi';

type ImageEditRequest = {
  prompt: string;
  images: { type: 'image'; image: string }[];
};

type ImageEditResponse = {
  image: { base64Data: string; mimeType: string };
};

type StickerVersion = {
  id: string;
  image: string;
  label: string;
  isOriginal?: boolean;
};

const { width: screenWidth } = Dimensions.get('window');

const EditScreen = () => {
  const { originalImage, stickerImage, stickerId } = useLocalSearchParams<{
    originalImage: string;
    stickerImage: string;
    stickerId?: string;
  }>();
  const { saveSticker, getStickerById } = useUser();
  const [editPrompt, setEditPrompt] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentVersionIndex, setCurrentVersionIndex] = useState<number>(0);
  const textInputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);
  
  // Initialize with data immediately if available for instant rendering
  const [versions, setVersions] = useState<StickerVersion[]>(() => {
    if (stickerImage || originalImage) {
      return [{
        id: 'original',
        image: stickerImage || originalImage,
        label: 'Original',
        isOriginal: true,
      }];
    }
    return [];
  });
  
  // Only show loading if we need to fetch data
  const [isInitializing, setIsInitializing] = useState<boolean>(!!stickerId && !stickerImage && !originalImage);
  
  // Load sticker data if using stickerId
  React.useEffect(() => {
    // Only load if we have stickerId but no direct image data
    if (stickerId && !stickerImage && !originalImage && getStickerById) {
      const loadSticker = async () => {
        try {
          const sticker = await getStickerById(stickerId);
          if (sticker) {
            setVersions([{
              id: 'original',
              image: sticker.stickerImage,
              label: 'Original',
              isOriginal: true,
            }]);
            
            // Pre-populate the edit prompt with the saved title if available
            // The title contains the user's original request
            if (sticker.title) {
              // Extract the meaningful part from the title
              // Format is usually "Edit X: [user's request]..."
              const titleParts = sticker.title.split(':');
              if (titleParts.length > 1) {
                // Get the user's request part and clean it up
                const userRequest = titleParts[1].trim().replace('...', '');
                setEditPrompt(userRequest);
              } else {
                // If no colon, use the whole title
                setEditPrompt(sticker.title);
              }
            }
          } else {
            Alert.alert('Error', 'Sticker not found');
            router.back();
          }
        } catch (error) {
          console.error('Error loading sticker:', error);
          Alert.alert('Error', 'Failed to load sticker');
          router.back();
        } finally {
          setIsInitializing(false);
        }
      };
      loadSticker();
    }
  }, [stickerId, getStickerById, stickerImage, originalImage]);

  // Memoized and optimized image conversion
  // Optimized image conversion with caching
  const imageCache = React.useRef(new Map<string, string>());
  
  const convertImageToBase64 = React.useCallback(async (imageUri: string): Promise<string> => {
    // Check cache first
    if (imageCache.current.has(imageUri)) {
      return imageCache.current.get(imageUri)!;
    }
    
    try {
      if (imageUri.startsWith('data:')) {
        const base64 = imageUri.split(',')[1];
        imageCache.current.set(imageUri, base64);
        return base64;
      }
      
      // For non-data URLs, assume they're already base64 or don't need conversion
      // This avoids unnecessary fetching
      imageCache.current.set(imageUri, imageUri);
      return imageUri;
    } catch (error: any) {
      console.error('Error processing image:', error);
      throw new Error('Failed to process image');
    }
  }, []);

  // Local fallback for when API is unavailable
  const createLocalFallbackEdit = React.useCallback(async (base64Data: string, promptToUse: string): Promise<ImageEditResponse> => {
    console.log('Creating local fallback edit with style hint');
    
    // Create a simple style indicator overlay
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      return new Promise((resolve) => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            resolve({
              image: {
                base64Data: base64Data,
                mimeType: 'image/png'
              }
            });
            return;
          }
          
          // Set canvas size
          canvas.width = 512;
          canvas.height = 512;
          
          // Create a new image from base64
          const img = new (window as any).Image();
          img.crossOrigin = 'anonymous';
          
          img.onload = () => {
            try {
              // Draw original image
              ctx.drawImage(img, 0, 0, 512, 512);
              
              // Apply filter based on prompt keywords
              const lowerPrompt = promptToUse.toLowerCase();
              
              if (lowerPrompt.includes('watercolor')) {
                ctx.filter = 'saturate(150%) contrast(90%) brightness(110%)';
                ctx.drawImage(img, 0, 0, 512, 512);
                ctx.filter = 'none';
                ctx.globalAlpha = 0.1;
                ctx.fillStyle = '#87CEEB';
                ctx.fillRect(0, 0, 512, 512);
              } else if (lowerPrompt.includes('vintage') || lowerPrompt.includes('retro')) {
                ctx.filter = 'sepia(40%) contrast(95%) brightness(105%)';
                ctx.drawImage(img, 0, 0, 512, 512);
              } else if (lowerPrompt.includes('kawaii') || lowerPrompt.includes('cute')) {
                ctx.filter = 'saturate(120%) brightness(115%) contrast(95%)';
                ctx.drawImage(img, 0, 0, 512, 512);
                ctx.filter = 'none';
                ctx.globalAlpha = 0.08;
                ctx.fillStyle = '#FFB6C1';
                ctx.fillRect(0, 0, 512, 512);
              } else if (lowerPrompt.includes('minimalist') || lowerPrompt.includes('simple')) {
                ctx.filter = 'contrast(110%) brightness(105%)';
                ctx.drawImage(img, 0, 0, 512, 512);
              } else if (lowerPrompt.includes('boho') || lowerPrompt.includes('bohemian')) {
                ctx.filter = 'sepia(20%) saturate(90%) contrast(105%)';
                ctx.drawImage(img, 0, 0, 512, 512);
              } else if (lowerPrompt.includes('floral') || lowerPrompt.includes('botanical')) {
                ctx.filter = 'saturate(130%) brightness(108%)';
                ctx.drawImage(img, 0, 0, 512, 512);
              } else if (lowerPrompt.includes('geometric')) {
                ctx.filter = 'contrast(120%) saturate(90%)';
                ctx.drawImage(img, 0, 0, 512, 512);
              } else if (lowerPrompt.includes('sketch') || lowerPrompt.includes('hand-drawn')) {
                ctx.filter = 'grayscale(100%) contrast(150%)';
                ctx.drawImage(img, 0, 0, 512, 512);
              } else {
                // Default enhancement
                ctx.filter = 'contrast(105%) brightness(105%) saturate(105%)';
                ctx.drawImage(img, 0, 0, 512, 512);
              }
              
              ctx.filter = 'none';
              ctx.globalAlpha = 1.0;
              
              // Convert to base64
              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    resolve({
                      image: {
                        base64Data: base64Data,
                        mimeType: 'image/png'
                      }
                    });
                    return;
                  }
                  
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const result = reader.result as string;
                    const base64Result = result.split(',')[1];
                    resolve({
                      image: {
                        base64Data: base64Result,
                        mimeType: 'image/png'
                      }
                    });
                  };
                  reader.readAsDataURL(blob);
                },
                'image/png',
                0.9
              );
            } catch (error) {
              console.error('Error in image processing:', error);
              resolve({
                image: {
                  base64Data: base64Data,
                  mimeType: 'image/png'
                }
              });
            }
          };
          
          img.onerror = () => {
            console.error('Failed to load image for fallback processing');
            resolve({
              image: {
                base64Data: base64Data,
                mimeType: 'image/png'
              }
            });
          };
          
          // Load the image
          img.src = `data:image/png;base64,${base64Data}`;
        } catch (error) {
          console.error('Fallback processing failed:', error);
          resolve({
            image: {
              base64Data: base64Data,
              mimeType: 'image/png'
            }
          });
        }
      });
    }
    
    // Return original if not on web
    return {
      image: {
        base64Data: base64Data,
        mimeType: 'image/png'
      }
    };
  }, []);



  const processEditWithRetry = React.useCallback(async (base64Data: string, promptToUse: string, retryCount: number = 0): Promise<ImageEditResponse> => {
    const prompt = await getEditPrompt(promptToUse);
    
    try {
      console.log('Sending edit request...');
      
      const data = await callImageEditApi(base64Data, prompt, retryCount);
      
      console.log('Edit completed successfully!');
      
      console.log('Skipping aggressive background removal to preserve quality...');
      
      const cleanedBase64 = data.image.base64Data;
      
      return {
        image: {
          base64Data: cleanedBase64,
          mimeType: data.image.mimeType
        }
      };
    } catch (error: any) {
      console.log('Processing error - using style fallback');
      const fallbackResult = await createLocalFallbackEdit(base64Data, promptToUse);
      return fallbackResult;
    }
  }, [createLocalFallbackEdit]);

  const handleEditSticker = React.useCallback(async () => {
    const promptToUse = editPrompt;
    
    if (!promptToUse.trim()) {
      Alert.alert('Edit Request Required', 'Please describe what changes you\'d like to make to the sticker.');
      return;
    }

    // Dismiss keyboard when starting edit
    Keyboard.dismiss();

    // IMPORTANT: Always use the ORIGINAL sticker (first version) as the base for edits
    // This ensures we're editing the original sticker with the new prompt, not editing edits
    const originalStickerImage = versions[0]?.image;
    if (!originalStickerImage || originalStickerImage.trim() === '') {
      Alert.alert('Error', 'No valid original sticker image found to edit. Please go back and try again.');
      return;
    }

    // Immediate UI feedback
    setIsProcessing(true);
    console.log('Starting sticker edit...');

    try {
      // Always convert the ORIGINAL sticker for editing
      let base64Data = await convertImageToBase64(originalStickerImage);
      
      // Check image size and compress if needed
      const imageSizeMB = estimateBase64Size(base64Data);
      console.log(`Image size: ${imageSizeMB.toFixed(2)}MB`);
      
      if (imageSizeMB > 0.5) { // More aggressive compression threshold
        console.log('Optimizing image for processing...');
        base64Data = await compressBase64Image(base64Data, 512, 512, 0.6); // Even more aggressive compression
        const newSizeMB = estimateBase64Size(base64Data);
        console.log(`Image optimized: ${newSizeMB.toFixed(2)}MB`);
      }
      
      console.log('Starting edit processing...');
      
      // Process the edit - fallback is handled internally now
      const data = await processEditWithRetry(base64Data, promptToUse);
      const editedImageUri = `data:${data.image.mimeType};base64,${data.image.base64Data}`;
      
      // Add new version to the list
      const newVersion: StickerVersion = {
        id: Date.now().toString(),
        image: editedImageUri,
        label: `Edit ${versions.length}`,
      };
      
      const updatedVersions = [...versions, newVersion];
      setVersions(updatedVersions);
      
      // Navigate to the new version
      const newIndex = updatedVersions.length - 1;
      setCurrentVersionIndex(newIndex);
      
      // Scroll to new version with a slight delay to ensure FlatList is updated
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ 
          index: newIndex, 
          animated: true 
        });
      }, 100);
      
      console.log('Edit processing complete!');
      
      // Success - no alert needed since fallback is seamless
    } catch (error: any) {
      console.error('Error editing sticker:', error);
      Alert.alert('Edit Error', 'Failed to process the edit. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [editPrompt, convertImageToBase64, processEditWithRetry, versions]);

  const handleSaveAndPurchase = React.useCallback(async () => {
    const currentVersion = versions[currentVersionIndex];
    // Allow saving any version including the original
    if (!currentVersion || !currentVersion.image || currentVersion.image.trim() === '') {
      Alert.alert('Error', 'No sticker image available to save.');
      return;
    }

    try {
      // Use the first version (original) as the base image if originalImage is not provided
      const baseImage = originalImage || versions[0]?.image;
      if (!baseImage) {
        Alert.alert('Error', 'No base image found.');
        return;
      }
      
      // Save with the edit prompt so it can be reused when editing again
      const titleToSave = editPrompt.trim() ? editPrompt : `${currentVersion.label} version`;
      await saveSticker(baseImage, currentVersion.image, titleToSave);
      
      Alert.alert(
        'Sticker Saved!',
        'Your edited sticker has been saved to your gallery. Would you like to purchase it now?',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Purchase Now',
            onPress: () => {
              router.push({
                pathname: '/checkout',
                params: {
                  originalImage: baseImage,
                  finalStickers: currentVersion.image,
                  isReorder: 'false',
                },
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error saving edited sticker:', error);
      Alert.alert('Save Error', 'Failed to save the edited sticker. Please try again.');
    }
  }, [versions, currentVersionIndex, originalImage, editPrompt, saveSticker]);

  const navigateToVersion = React.useCallback((index: number) => {
    if (index >= 0 && index < versions.length) {
      setCurrentVersionIndex(index);
      flatListRef.current?.scrollToIndex({ 
        index, 
        animated: true 
      });
    }
  }, [versions.length]);

  const handleResetToOriginal = React.useCallback(() => {
    Alert.alert(
      'Reset to Original',
      'This will clear all edits and return to the original sticker. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setVersions([versions[0]]); // Keep only original
            setCurrentVersionIndex(0);
            setEditPrompt('');
          },
        },
      ]
    );
  }, [versions]);

  const renderVersionItem = React.useCallback(({ item, index }: { item: StickerVersion; index: number }) => (
    <View style={styles.versionContainer}>
      <Image 
        source={{ uri: item.image }} 
        style={styles.versionImage} 
        resizeMode="contain"
      />
      <View style={styles.versionOverlay}>
        <View style={[styles.versionBadge, item.isOriginal && styles.originalBadge]}>
          {item.isOriginal && <RotateCcw size={12} color={neutralColors.white} />}
          <Text style={styles.versionBadgeText}>{item.label}</Text>
        </View>
      </View>
    </View>
  ), []);

  const handleGoBack = React.useCallback(() => {
    if (isProcessing) {
      Alert.alert(
        'Processing in Progress',
        'Please wait for the edit to complete before going back.',
        [{ text: 'OK' }]
      );
      return;
    }
    router.back();
  }, [isProcessing]);

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={neutralColors.primary} />
        <Text style={styles.loadingText}>Loading sticker...</Text>
      </View>
    );
  }
  
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleGoBack}
            disabled={isProcessing}
          >
            <ArrowLeft size={20} color={neutralColors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Edit Sticker</Text>
          </View>
          {versions.length > 1 ? (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleResetToOriginal}
            >
              <RotateCcw size={16} color={neutralColors.text.secondary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        <View style={styles.mainContent}>
          {/* Full Screen Version Gallery */}
          <View style={styles.galleryContainer}>
            <FlatList
              ref={flatListRef}
              data={versions}
              renderItem={renderVersionItem}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={screenWidth}
              snapToAlignment="start"
              bounces={false}
              scrollEventThrottle={16}
              onScroll={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
                if (index !== currentVersionIndex && index >= 0 && index < versions.length) {
                  setCurrentVersionIndex(index);
                }
              }}
              getItemLayout={(data, index) => ({
                length: screenWidth,
                offset: screenWidth * index,
                index,
              })}
            />
                
            {/* Navigation Arrows */}
            {versions.length > 1 && (
              <>
                {currentVersionIndex > 0 && (
                  <TouchableOpacity
                    style={[styles.navArrow, styles.navArrowLeft]}
                    onPress={() => navigateToVersion(currentVersionIndex - 1)}
                  >
                    <ChevronLeft size={28} color={neutralColors.white} />
                  </TouchableOpacity>
                )}
                {currentVersionIndex < versions.length - 1 && (
                  <TouchableOpacity
                    style={[styles.navArrow, styles.navArrowRight]}
                    onPress={() => navigateToVersion(currentVersionIndex + 1)}
                  >
                    <ChevronRight size={28} color={neutralColors.white} />
                  </TouchableOpacity>
                )}
              </>
            )}
            
            {/* Version Indicator */}
            {versions.length > 1 && (
              <View style={styles.versionIndicator}>
                <Text style={styles.versionIndicatorText}>
                  {currentVersionIndex + 1} of {versions.length}
                </Text>
              </View>
            )}
          </View>
              
          {/* Version Dots */}
          {versions.length > 1 && (
            <View style={styles.versionDots}>
              {versions.map((_, index) => (
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

          {/* Edit Tools Section */}
          <View style={styles.editToolsContainer}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 60}
            >
              <View style={styles.promptContainer}>
                <TextInput
                  ref={textInputRef}
                  style={styles.promptInput}
                  value={editPrompt}
                  onChangeText={setEditPrompt}
                  placeholder="Describe your changes (e.g., make it watercolor style, add flowers, make it minimalist)..."
                  placeholderTextColor={neutralColors.text.secondary}
                  multiline
                  textAlignVertical="top"
                  editable={!isProcessing}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={Keyboard.dismiss}
                  selectionColor={neutralColors.primary}
                  underlineColorAndroid="transparent"
                  autoCorrect={true}
                  spellCheck={true}
                />
              </View>
            </KeyboardAvoidingView>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.editButton,
                  (isProcessing || !editPrompt.trim()) && styles.editButtonDisabled,
                ]}
                onPress={handleEditSticker}
                disabled={isProcessing || !editPrompt.trim()}
                activeOpacity={0.8}
              >
                {isProcessing ? (
                  <>
                    <ActivityIndicator size="small" color={neutralColors.white} />
                    <Text style={styles.editButtonText}>Processing...</Text>
                  </>
                ) : (
                  <>
                    <Sparkles size={20} color={neutralColors.white} />
                    <Text style={styles.editButtonText}>Apply Edit</Text>
                  </>
                )}
              </TouchableOpacity>
              
              {versions.length >= 1 && (
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveAndPurchase}
                  disabled={isProcessing}
                >
                  <Save size={18} color={neutralColors.white} />
                  <Text style={styles.saveButtonText}>Save & Purchase</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        </SafeAreaView>
      </View>
    </TouchableWithoutFeedback>
  );
};

export default React.memo(EditScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: neutralColors.background,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: neutralColors.border,
    backgroundColor: neutralColors.white,
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
  headerSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 260,
  },
  galleryContainer: {
    flex: 1,
    backgroundColor: neutralColors.white,
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  versionContainer: {
    width: screenWidth,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingVertical: 20,
    backgroundColor: neutralColors.white,
  },
  versionImage: {
    width: '85%',
    height: '85%',
  },
  versionOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  versionBadge: {
    backgroundColor: neutralColors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  originalBadge: {
    backgroundColor: neutralColors.text.secondary,
  },
  versionBadgeText: {
    color: neutralColors.white,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navArrowLeft: {
    left: 16,
  },
  navArrowRight: {
    right: 16,
  },
  versionIndicator: {
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
  versionDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
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
  promptContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  promptInputContainer: {
    backgroundColor: neutralColors.white,
    borderWidth: 1,
    borderColor: neutralColors.border,
    borderRadius: 16,
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  promptLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: neutralColors.text.primary,
    marginBottom: 8,
  },
  promptInput: {
    padding: 12,
    fontSize: 15,
    color: neutralColors.text.primary,
    backgroundColor: neutralColors.white,
    borderWidth: 1,
    borderColor: neutralColors.border,
    borderRadius: 12,
    minHeight: 80,
    maxHeight: 120,
    textAlignVertical: 'top',
    includeFontPadding: false,
    lineHeight: 20,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    gap: 10,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  resetButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: neutralColors.surface,
  },
  resetButtonText: {
    color: neutralColors.text.secondary,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  editButton: {
    backgroundColor: neutralColors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: neutralColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  editButtonDisabled: {
    opacity: 0.6,
  },
  editButtonText: {
    color: neutralColors.white,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  saveButton: {
    backgroundColor: neutralColors.success,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: neutralColors.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButtonText: {
    color: neutralColors.white,
    fontSize: 15,
    fontWeight: '600' as const,
  },

  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: neutralColors.text.secondary,
  },
  mainContent: {
    flex: 1,
    position: 'relative',
  },
  editToolsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: neutralColors.background,
    borderTopWidth: 1,
    borderTopColor: neutralColors.border,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    shadowColor: neutralColors.gray900,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },

});