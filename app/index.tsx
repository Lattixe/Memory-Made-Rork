import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Upload, Sparkles, ArrowRight, LogOut, User, Grid3X3, Wand2, Settings } from 'lucide-react-native';
import { memoryMadeColors } from '@/constants/colors';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useUser, SavedSticker } from '@/contexts/UserContext';
import LoginForm from '@/components/LoginForm';
import StickerGallery from '@/components/StickerGallery';
import { safeJsonParse } from '@/utils/json';
import { processStickerImage } from '@/utils/backgroundRemover';
import { getInitialGenerationPrompt, getRegenerationPrompt } from '@/utils/promptManager';


type ImageEditRequest = {
  prompt: string;
  images: { type: 'image'; image: string }[];
};

type ImageEditResponse = {
  image: { base64Data: string; mimeType: string };
};



export default function UploadScreen() {
  const { user, savedStickers, isLoading, login, signup, logout, deleteSticker, saveSticker } = useUser();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showGallery, setShowGallery] = useState<boolean>(false);
  const [promptText, setPromptText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);

  const requestPermissions = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant camera roll permissions to upload photos.'
        );
        return false;
      }
    }
    return true;
  }, []);

  const pickImage = useCallback(async () => {
    Keyboard.dismiss();
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  }, [requestPermissions]);

  const takePhoto = useCallback(async () => {
    Keyboard.dismiss();
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant camera permissions to take photos.'
        );
        return;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  }, [requestPermissions]);

  const compressImage = useCallback(async (uri: string, quality: number = 0.5): Promise<string> => {
    try {
      // Skip compression for data URLs that are already base64
      if (uri.startsWith('data:')) {
        return uri.split(',')[1];
      }
      
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        
        // Check file size and compress more aggressively if needed
        const fileSizeMB = blob.size / (1024 * 1024);
        let targetQuality = quality;
        let maxDimension = 800; // Reduced default for faster processing
        
        if (fileSizeMB > 5) {
          targetQuality = 0.25; // More aggressive compression
          maxDimension = 600;
        } else if (fileSizeMB > 2) {
          targetQuality = 0.35;
          maxDimension = 700;
        }
        
        console.log(`Compressing image: ${fileSizeMB.toFixed(2)}MB, quality: ${targetQuality}, max dimension: ${maxDimension}`);
        
        return new Promise((resolve, reject) => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new (window as any).Image();
          
          img.onload = () => {
            let { width, height } = img;
            
            // More aggressive resizing for large images
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = (height * maxDimension) / width;
                width = maxDimension;
              } else {
                width = (width * maxDimension) / height;
                height = maxDimension;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            ctx?.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', targetQuality);
            const base64Data = compressedDataUrl.split(',')[1];
            
            // Check final size
            const finalSizeMB = (base64Data.length * 0.75) / (1024 * 1024); // Rough base64 to bytes conversion
            console.log(`Compressed to: ${finalSizeMB.toFixed(2)}MB`);
            
            resolve(base64Data);
          };
          
          img.onerror = () => reject(new Error('Failed to load image for compression'));
          img.src = URL.createObjectURL(blob);
        });
      } else {
        // For mobile, convert to base64 and check size
        const response = await fetch(uri);
        const blob = await response.blob();
        const fileSizeMB = blob.size / (1024 * 1024);
        
        console.log(`Mobile image size: ${fileSizeMB.toFixed(2)}MB`);
        
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            
            // If image is too large, warn but proceed
            if (fileSizeMB > 3) {
              console.warn('Large image detected, processing may take longer');
            }
            
            resolve(base64Data);
          };
          reader.onerror = () => reject(new Error('Failed to read image file'));
          reader.readAsDataURL(blob);
        });
      }
    } catch (error) {
      console.error('Error compressing image:', error);
      throw new Error('Failed to process image. Please try with a different image.');
    }
  }, []);

  const processImageWithRetry = useCallback(async (base64Data: string, retryCount: number = 0): Promise<ImageEditResponse> => {
    const maxRetries = 5; // Increased retries for better reliability
    const baseTimeout = 90000; // 90 seconds base timeout
    const timeout = baseTimeout + (retryCount * 30000); // Add 30s per retry
    
    const prompt = await getInitialGenerationPrompt();
    
    const requestBody: ImageEditRequest = {
      prompt,
      images: [{ type: 'image', image: base64Data }],
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log(`Sending request to AI API (attempt ${retryCount + 1}/${maxRetries + 1}) with ${timeout/1000}s timeout...`);
      
      const response = await fetch('https://toolkit.rork.com/images/edit/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`API Error ${response.status}:`, errorText.substring(0, 500));
        
        // More aggressive retry strategy for server errors
        if ((response.status >= 500 || response.status === 429 || response.status === 408) && retryCount < maxRetries) {
          const delay = Math.min(3000 * Math.pow(1.5, retryCount), 15000);
          console.log(`Server error (${response.status}), retrying in ${delay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return processImageWithRetry(base64Data, retryCount + 1);
        }
        
        throw new Error(`API request failed with status ${response.status}`);
      }

      const responseText = await response.text();
      
      // Enhanced JSON parsing with better error handling
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Empty response from server');
      }
      
      // Check if response looks like HTML (error page)
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        console.error('Received HTML error page instead of JSON:', responseText.substring(0, 200));
        throw new Error('Server returned an error page instead of data');
      }
      
      // Use safe JSON parsing to handle potential parsing errors
      const parseResult = safeJsonParse<ImageEditResponse>(responseText);
      
      if (!parseResult.success) {
        console.error('JSON parse error:', parseResult.error);
        console.error('Response preview:', responseText.substring(0, 300));
        
        // If JSON parsing fails, it might be a server error - retry
        if (retryCount < maxRetries) {
          const delay = Math.min(2000 * Math.pow(1.5, retryCount), 10000);
          console.log(`JSON parse failed, retrying in ${delay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return processImageWithRetry(base64Data, retryCount + 1);
        }
        
        throw new Error(`Server returned invalid data format: ${parseResult.error}`);
      }
      
      const data = parseResult.data!;
      
      // Validate response structure
      if (!data || !data.image || !data.image.base64Data) {
        console.error('Invalid response structure:', data);
        throw new Error('Server returned incomplete image data');
      }
      
      console.log('AI processing completed successfully!');
      
      // Apply aggressive background removal for AI-generated stickers
      console.log('Applying enhanced background removal and auto-cropping...');
      const cleanedBase64 = await processStickerImage(data.image.base64Data, false, true); // Don't skip removal, mark as AI-generated
      
      return {
        image: {
          base64Data: cleanedBase64,
          mimeType: data.image.mimeType
        }
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError' || error.message?.includes('timed out')) {
        if (retryCount < maxRetries) {
          // Exponential backoff with jitter
          const baseDelay = 5000;
          const maxDelay = 30000;
          const jitter = Math.random() * 3000; // 0-3 seconds random jitter
          const delay = Math.min(baseDelay * Math.pow(2, retryCount) + jitter, maxDelay);
          
          console.log(`Request timed out (attempt ${retryCount + 1}/${maxRetries}), retrying in ${Math.round(delay/1000)} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return processImageWithRetry(base64Data, retryCount + 1);
        }
        throw new Error('Request timed out after multiple attempts. The server may be overloaded.');
      }
      
      // Enhanced error detection and retry logic
      const errorMessage = error.message?.toLowerCase() || '';
      const shouldRetry = retryCount < maxRetries && (
        errorMessage.includes('504') || 
        errorMessage.includes('502') || 
        errorMessage.includes('503') ||
        errorMessage.includes('500') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('timed out') ||
        errorMessage.includes('network') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('failed to fetch') ||
        errorMessage.includes('server returned') ||
        errorMessage.includes('empty response') ||
        errorMessage.includes('overloaded') ||
        errorMessage.includes('abort')
      );
      
      if (shouldRetry) {
        // Exponential backoff with jitter for server errors
        const baseDelay = 4000;
        const maxDelay = 25000;
        const jitter = Math.random() * 2000;
        const delay = Math.min(baseDelay * Math.pow(1.8, retryCount) + jitter, maxDelay);
        
        console.log(`Server/network error (${error.message}), retrying in ${Math.round(delay/1000)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return processImageWithRetry(base64Data, retryCount + 1);
      }
      
      throw error;
    }
  }, []);

  const generateStickerFromPrompt = useCallback(async () => {
    if (!promptText.trim()) {
      Alert.alert('Prompt Required', 'Please enter a description for your custom sticker.');
      return;
    }

    Keyboard.dismiss();
    // Immediate UI feedback
    setIsGenerating(true);
    console.log('Starting AI sticker generation from prompt using Gemini Flash...');
    
    try {
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

      const prompt = await getRegenerationPrompt(promptText);
      
      const requestBody: ImageEditRequest = {
        prompt,
        images: [{ type: 'image', image: base64Data }],
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for generation

      const response = await fetch('https://toolkit.rork.com/images/edit/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`API Error ${response.status}:`, errorText.substring(0, 500));
        throw new Error(`Failed to generate sticker: ${response.status}`);
      }

      const responseText = await response.text();
      
      // Enhanced JSON parsing with better error handling
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Empty response from server');
      }
      
      // Check if response looks like HTML (error page)
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        console.error('Received HTML error page instead of JSON:', responseText.substring(0, 200));
        throw new Error('Server returned an error page instead of data');
      }
      
      // Use safe JSON parsing to handle potential parsing errors
      const parseResult = safeJsonParse<ImageEditResponse>(responseText);
      
      if (!parseResult.success) {
        console.error('JSON parse error:', parseResult.error);
        console.error('Response preview:', responseText.substring(0, 300));
        throw new Error(`Server returned invalid data format: ${parseResult.error}`);
      }
      
      const data = parseResult.data!;
      
      // Validate response structure
      if (!data || !data.image || !data.image.base64Data) {
        console.error('Invalid response structure:', data);
        throw new Error('Server returned incomplete image data');
      }

      console.log('AI generation completed successfully!');
      
      // Apply aggressive background removal for AI-generated stickers
      console.log('Applying enhanced background removal and auto-cropping...');
      const cleanedBase64 = await processStickerImage(data.image.base64Data, false, true);
      
      const generatedImageUri = `data:${data.image.mimeType};base64,${cleanedBase64}`;
      
      // Navigate immediately for better UX - saving will happen in review screen
      setIsNavigating(true);
      router.push({
        pathname: '/review',
        params: {
          originalImage: generatedImageUri,
          generatedStickers: generatedImageUri,
          isCustomGenerated: 'true',
          customPrompt: promptText.trim(),
        },
      });
      setTimeout(() => setIsNavigating(false), 1000);
    } catch (error: any) {
      console.error('Error generating sticker:', error);
      
      let errorMessage = 'Failed to generate custom sticker. Please try again.';
      let errorTitle = 'Generation Error';
      
      if (error.name === 'AbortError' || error.message.includes('timeout') || error.message.includes('timed out')) {
        errorTitle = 'Request Timeout';
        errorMessage = 'Generation is taking longer than expected. The server may be busy. Please try again in a few moments.';
      } else if (error.message.includes('504') || error.message.includes('502') || error.message.includes('503') || error.message.includes('500')) {
        errorTitle = 'Server Busy';
        errorMessage = 'The AI service is temporarily overloaded. Please wait 30-60 seconds and try again.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorTitle = 'Connection Issue';
        errorMessage = 'Network connection problem. Please check your internet connection and try again.';
      } else if (error.message.includes('Server returned') || error.message.includes('invalid data')) {
        errorTitle = 'Server Error';
        errorMessage = 'The server returned an unexpected response. Please try again or contact support if the issue persists.';
      }
      
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [promptText]);

  const processImage = useCallback(async () => {
    if (!selectedImage || isNavigating) return;

    Keyboard.dismiss();
    // Immediate UI feedback
    setIsProcessing(true);
    setIsNavigating(true);
    console.log('Starting image processing...');
    
    try {
      // Navigate immediately for better UX
      router.push({
        pathname: '/review',
        params: {
          originalImage: selectedImage,
          generatedStickers: '',
          isProcessing: 'true',
        },
      });
      
      // Process in background after navigation
      setTimeout(async () => {
        try {
          // Get base64 data from the selected image with compression
          let base64Data: string;
          if (selectedImage.startsWith('data:')) {
            base64Data = selectedImage.split(',')[1];
          } else {
            // Compress image before sending to reduce timeout risk
            base64Data = await compressImage(selectedImage);
          }

          console.log('Image compressed, starting AI processing...');
          const data = await processImageWithRetry(base64Data);
          console.log('AI processing complete!');

          const generatedStickerUri = `data:${data.image.mimeType};base64,${data.image.base64Data}`;
          
          // Update the review screen with processed data - saving will happen in review screen
          router.setParams({
            generatedStickers: generatedStickerUri,
            isProcessing: 'false',
          });
        } catch (error: any) {
          console.error('Error processing image:', error);
          router.setParams({
            processingError: error.message || 'Failed to generate stickers',
            isProcessing: 'false',
          });
        }
      }, 100);
    } catch (error: any) {
      console.error('Error processing image:', error);
      
      let errorMessage = 'Failed to generate stickers. Please try again.';
      let errorTitle = 'Processing Error';
      
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        errorTitle = 'Request Timeout';
        errorMessage = 'Processing is taking longer than expected. This usually happens when the server is busy. Please try again in a few moments.';
      } else if (error.message.includes('504') || error.message.includes('502') || error.message.includes('503') || error.message.includes('500')) {
        errorTitle = 'Server Busy';
        errorMessage = 'The AI service is temporarily overloaded. Please wait 30-60 seconds and try again.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorTitle = 'Connection Issue';
        errorMessage = 'Network connection problem. Please check your internet connection and try again.';
      } else if (error.message.includes('Server returned') || error.message.includes('invalid data')) {
        errorTitle = 'Server Error';
        errorMessage = 'The server returned an unexpected response. Please try again or contact support if the issue persists.';
      } else if (error.message.includes('Failed to process image')) {
        errorMessage = error.message;
      }
      
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setIsNavigating(false), 1000);
    }
  }, [selectedImage, compressImage, processImageWithRetry, isNavigating]);

  const handleSelectSticker = useCallback((sticker: SavedSticker) => {
    if (isNavigating) return;
    Keyboard.dismiss();
    setSelectedImage(sticker.originalImage);
    setShowGallery(false);
  }, [isNavigating]);

  const handleLogout = useCallback(async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your saved stickers will be removed from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  }, [logout]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={memoryMadeColors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView 
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView 
              style={styles.loginScrollView}
              contentContainerStyle={styles.loginScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <LoginForm onLogin={login} onSignup={(email, password) => signup(email, password)} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView 
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
            <View style={styles.content}>
            <View style={styles.userHeader}>
              <View style={styles.userInfo}>
                <View style={styles.userAvatar}>
                  <User size={20} color={memoryMadeColors.primary} />
                </View>
                <View>
                  <Text style={styles.userName}>Welcome, {user.name}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                </View>
              </View>
              <View style={styles.headerButtons}>
                <TouchableOpacity style={styles.settingsButton} onPress={() => { 
                  if (isNavigating) return;
                  Keyboard.dismiss(); 
                  setIsNavigating(true);
                  router.push('/admin');
                  setTimeout(() => setIsNavigating(false), 1000);
                }} activeOpacity={0.7} disabled={isNavigating}>
                  <Settings size={18} color={memoryMadeColors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
                  <LogOut size={18} color={memoryMadeColors.text.secondary} />
                </TouchableOpacity>
              </View>
            </View>

            {showGallery ? (
              <View style={styles.galleryContainer}>
                <StickerGallery
                  stickers={savedStickers}
                  onDeleteSticker={deleteSticker}
                  onSelectSticker={handleSelectSticker}
                  onBack={() => setShowGallery(false)}
                />
                <TouchableOpacity
                  style={styles.newStickerButton}
                  onPress={() => setShowGallery(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.newStickerButtonText}>Create New Sticker</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {savedStickers.length > 0 && (
                  <>
                    <TouchableOpacity
                      style={styles.galleryToggle}
                      onPress={() => setShowGallery(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.galleryToggleText}>
                        View Saved Stickers ({savedStickers.length})
                      </Text>
                      <ArrowRight size={16} color={memoryMadeColors.primary} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.stickerSheetButton}
                      onPress={() => { 
                        if (isNavigating) return;
                        Keyboard.dismiss(); 
                        setIsNavigating(true);
                        router.push('/sticker-sheet');
                        setTimeout(() => setIsNavigating(false), 1000);
                      }}
                      disabled={isNavigating}
                      activeOpacity={0.7}
                    >
                      <Grid3X3 size={20} color={memoryMadeColors.white} />
                      <Text style={styles.stickerSheetButtonText}>
                        Create Sticker Sheet
                      </Text>
                      <Text style={styles.stickerSheetSubtext}>
                        Combine multiple stickers on one sheet
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                <View style={styles.imageContainer}>
                  {selectedImage ? (
                    <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
                  ) : (
                    <View style={styles.placeholderContainer}>
                      <View style={styles.placeholderIcon}>
                        <Upload size={28} color={memoryMadeColors.gray400} />
                      </View>
                      <Text style={styles.placeholderText}>
                        Snap a memory to get started
                      </Text>
                      <Text style={styles.placeholderSubtext}>
                        Easy 3-step process: Snap • Ship • Stick
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={takePhoto}
                    disabled={isProcessing || isGenerating || isNavigating}
                    activeOpacity={0.7}
                  >
                    <Camera size={20} color={memoryMadeColors.gray600} />
                    <Text style={styles.actionButtonText}>Camera</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={pickImage}
                    disabled={isProcessing || isGenerating || isNavigating}
                    activeOpacity={0.7}
                  >
                    <Upload size={20} color={memoryMadeColors.gray600} />
                    <Text style={styles.actionButtonText}>Photos</Text>
                  </TouchableOpacity>
                </View>

                {!selectedImage && (
                  <View style={styles.promptContainer}>
                    <Text style={styles.promptLabel}>Or create a custom sticker with AI</Text>
                    <View style={styles.promptInputContainer}>
                      <TextInput
                        style={styles.promptInput}
                        placeholder="Describe your sticker idea... (e.g., 'cute cartoon cat with sunglasses')"
                        placeholderTextColor={memoryMadeColors.text.secondary}
                        value={promptText}
                        onChangeText={setPromptText}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        editable={!isProcessing && !isGenerating}
                        selectionColor={memoryMadeColors.primary}
                        underlineColorAndroid="transparent"
                        autoCorrect={false}
                        spellCheck={false}
                      />
                    </View>
                    
                    {promptText.trim() && (
                      <TouchableOpacity
                        style={[
                          styles.generateFromPromptButton,
                          isGenerating && styles.generateButtonDisabled,
                        ]}
                        onPress={generateStickerFromPrompt}
                        disabled={isProcessing || isGenerating || isNavigating}
                        activeOpacity={0.7}
                      >
                        {isGenerating ? (
                          <View style={styles.buttonContent}>
                            <ActivityIndicator size="small" color={memoryMadeColors.white} />
                            <Text style={styles.generateButtonText}>Creating your custom sticker...</Text>
                          </View>
                        ) : (
                          <View style={styles.buttonContent}>
                            <Wand2 size={20} color={memoryMadeColors.white} />
                            <Text style={styles.generateButtonText}>Generate Custom Sticker</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {selectedImage && (
                  <TouchableOpacity
                    style={[
                      styles.generateButton,
                      isProcessing && styles.generateButtonDisabled,
                    ]}
                    onPress={processImage}
                    disabled={isProcessing || isGenerating || isNavigating}
                    activeOpacity={0.7}
                  >
                    {isProcessing ? (
                      <View style={styles.buttonContent}>
                        <ActivityIndicator size="small" color={memoryMadeColors.white} />
                        <Text style={styles.generateButtonText}>Creating your memory stickers...</Text>
                      </View>
                    ) : (
                      <View style={styles.buttonContent}>
                        <Text style={styles.generateButtonText}>Create Memory Stickers</Text>
                        <ArrowRight size={20} color={memoryMadeColors.white} />
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: memoryMadeColors.cream,
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
    padding: 20,
    paddingBottom: 24,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: memoryMadeColors.text.secondary,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: memoryMadeColors.border,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    backgroundColor: memoryMadeColors.surface,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: memoryMadeColors.border,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: memoryMadeColors.text.primary,
  },
  userEmail: {
    fontSize: 14,
    color: memoryMadeColors.text.secondary,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 8,
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
  },
  galleryToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: memoryMadeColors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: memoryMadeColors.border,
  },
  galleryToggleText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: memoryMadeColors.primary,
  },
  galleryContainer: {
    minHeight: 400,
  },
  newStickerButton: {
    backgroundColor: memoryMadeColors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  newStickerButtonText: {
    color: memoryMadeColors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },

  imageContainer: {
    height: 240,
    backgroundColor: memoryMadeColors.surface,
    borderRadius: 20,
    marginBottom: 20,
    marginTop: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: memoryMadeColors.border,
    borderStyle: 'dashed',
  },
  selectedImage: {
    width: '100%',
    height: 240,
    resizeMode: 'cover',
  },
  placeholderContainer: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  placeholderIcon: {
    width: 60,
    height: 60,
    backgroundColor: memoryMadeColors.gray100,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderText: {
    color: memoryMadeColors.text.primary,
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 6,
    textAlign: 'center',
  },
  placeholderSubtext: {
    color: memoryMadeColors.text.secondary,
    fontSize: 13,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: memoryMadeColors.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: memoryMadeColors.border,
    shadowColor: memoryMadeColors.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionButtonText: {
    color: memoryMadeColors.text.primary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  generateButton: {
    backgroundColor: memoryMadeColors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: memoryMadeColors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: memoryMadeColors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  stickerSheetButton: {
    backgroundColor: memoryMadeColors.primary,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: memoryMadeColors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  stickerSheetButtonText: {
    color: memoryMadeColors.white,
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 6,
    marginBottom: 2,
  },
  stickerSheetSubtext: {
    color: memoryMadeColors.white,
    fontSize: 12,
    opacity: 0.9,
    textAlign: 'center',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  loginScrollView: {
    flex: 1,
  },
  loginScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: '100%',
  },
  promptContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  promptLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: memoryMadeColors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  promptInputContainer: {
    backgroundColor: memoryMadeColors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: memoryMadeColors.border,
    marginBottom: 12,
    shadowColor: memoryMadeColors.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  promptInput: {
    padding: 16,
    fontSize: 15,
    color: memoryMadeColors.text.primary,
    backgroundColor: 'transparent',
    lineHeight: 20,
    minHeight: 80,
    maxHeight: 120,
    textAlignVertical: 'top',
    includeFontPadding: false,
  },
  generateFromPromptButton: {
    backgroundColor: memoryMadeColors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: memoryMadeColors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});