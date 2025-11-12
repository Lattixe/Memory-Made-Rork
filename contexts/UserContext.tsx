import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { setAuthToken, clearAuthToken } from '@/lib/authToken';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { safeJsonParse } from '@/utils/json';
import * as FileSystem from 'expo-file-system';
import { saveImageToIndexedDB, getImageFromIndexedDB, deleteImageFromIndexedDB, clearAllImagesFromIndexedDB } from '@/utils/webImageStorage';

export interface SavedSticker {
  id: string;
  originalImage: string;
  stickerImage: string;
  createdAt: string;
  title?: string;
  imageWidth?: number;
  imageHeight?: number;
}

interface StickerMetadata {
  id: string;
  originalImagePath: string;
  stickerImagePath: string;
  createdAt: string;
  title?: string;
  imageWidth?: number;
  imageHeight?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  token?: string;
}

export interface UserContextType {
  user: User | null;
  savedStickers: SavedSticker[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  saveSticker: (originalImage: string, stickerImage: string, title?: string) => Promise<void>;
  deleteSticker: (stickerId: string) => Promise<void>;
  refreshStickers: () => Promise<void>;
  getStickerById: (stickerId: string) => Promise<SavedSticker | null>;
  updateSticker: (stickerId: string, newStickerImage: string) => Promise<void>;
}

const USER_STORAGE_KEY = '@user_data';
const STICKERS_STORAGE_KEY = '@saved_stickers';
const getStickersDir = () => {
  if (Platform.OS === 'web') return '';
  try {
    const docDir = (FileSystem as any).documentDirectory;
    return docDir ? `${docDir}stickers/` : '';
  } catch {
    return '';
  }
};
const STICKERS_DIR = getStickersDir();

const ensureStickersDirectory = async () => {
  if (Platform.OS === 'web') return;
  const dirInfo = await FileSystem.getInfoAsync(STICKERS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(STICKERS_DIR, { intermediates: true });
  }
};

const saveImageToFile = async (base64Data: string, filename: string): Promise<string> => {
  if (Platform.OS === 'web') {
    await saveImageToIndexedDB(filename, base64Data);
    return filename;
  }
  await ensureStickersDirectory();
  const filePath = `${STICKERS_DIR}${filename}`;
  await FileSystem.writeAsStringAsync(filePath, base64Data, {
    encoding: 'base64' as any,
  });
  return filePath;
};

const readImageFromFile = async (filePath: string): Promise<string> => {
  try {
    console.log('[UserContext] Reading image from file:', filePath);
    if (Platform.OS === 'web') {
      const base64 = await getImageFromIndexedDB(filePath);
      if (!base64) {
        console.error('[UserContext] Image not found in IndexedDB:', filePath);
        throw new Error(`Image not found: ${filePath}`);
      }
      console.log('[UserContext] Successfully read image from IndexedDB, size:', base64.length);
      return `data:image/png;base64,${base64}`;
    }
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      console.error('[UserContext] File does not exist:', filePath);
      throw new Error(`File not found: ${filePath}`);
    }
    const base64 = await FileSystem.readAsStringAsync(filePath, {
      encoding: 'base64' as any,
    });
    console.log('[UserContext] Successfully read image from file, size:', base64.length);
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('[UserContext] Error reading image from file:', filePath, error);
    throw error;
  }
};

const deleteImageFile = async (filePath: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      await deleteImageFromIndexedDB(filePath);
      return;
    }
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath);
    }
  } catch (error) {
    console.error('Error deleting image file:', error);
  }
};

const extractBase64FromDataUri = (dataUri: string): string => {
  if (dataUri.startsWith('data:')) {
    return dataUri.split(',')[1] || dataUri;
  }
  return dataUri;
};

const getImageSizeFromDataUri = async (dataUri: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      const img = new (window as any).Image();
      img.onload = () => resolve({ width: img.naturalWidth ?? img.width, height: img.naturalHeight ?? img.height });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = dataUri;
    } else {
      // Image.getSize works with data URIs on native
      // We import dynamically to avoid circular deps
      // Using require to prevent type issues on web
      const { Image: RNImage } = require('react-native');
      RNImage.getSize(
        dataUri,
        (w: number, h: number) => resolve({ width: w, height: h }),
        () => resolve({ width: 0, height: 0 })
      );
    }
  });
};

export const [UserProvider, useUser] = createContextHook<UserContextType>(() => {
  const [user, setUser] = useState<User | null>(null);
  const [savedStickers, setSavedStickers] = useState<SavedSticker[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Performance optimization: Debounce storage operations
  const storageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadUserData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [userData, stickersData] = await Promise.all([
        AsyncStorage.getItem(USER_STORAGE_KEY),
        AsyncStorage.getItem(STICKERS_STORAGE_KEY)
      ]);

      if (userData) {
        const userResult = safeJsonParse<User>(userData);
        if (userResult.success && userResult.data && userResult.data.id) {
          setUser(userResult.data);
          await setAuthToken(userResult.data.token);
        } else {
          console.warn('Invalid user data format, clearing storage:', userResult.error);
          await AsyncStorage.removeItem(USER_STORAGE_KEY);
        }
      }

      if (stickersData) {
        const stickersResult = safeJsonParse<StickerMetadata[]>(stickersData);
        if (stickersResult.success && Array.isArray(stickersResult.data)) {
          console.log('[UserContext] Loading', stickersResult.data.length, 'stickers from storage');
          const loadedStickers = await Promise.all(
            stickersResult.data.map(async (metadata) => {
              try {
                console.log('[UserContext] Loading sticker:', metadata.id);
                const [originalImage, stickerImage] = await Promise.all([
                  readImageFromFile(metadata.originalImagePath),
                  readImageFromFile(metadata.stickerImagePath),
                ]);
                
                if (!originalImage || !stickerImage) {
                  console.error('[UserContext] Empty image URI for sticker:', metadata.id);
                  return null;
                }
                
                const sticker: SavedSticker = {
                  id: metadata.id,
                  originalImage,
                  stickerImage,
                  createdAt: metadata.createdAt,
                  title: metadata.title,
                  imageWidth: metadata.imageWidth,
                  imageHeight: metadata.imageHeight,
                };
                console.log('[UserContext] Successfully loaded sticker:', metadata.id);
                return sticker;
              } catch (error) {
                console.error(`[UserContext] Error loading sticker ${metadata.id}:`, error);
                return null;
              }
            })
          );
          const validStickers = loadedStickers.filter((s): s is SavedSticker => s !== null);
          console.log('[UserContext] Loaded', validStickers.length, 'valid stickers');
          setSavedStickers(validStickers);
        } else {
          console.warn('[UserContext] Invalid stickers data format, clearing storage:', stickersResult.error);
          await AsyncStorage.removeItem(STICKERS_STORAGE_KEY);
          setSavedStickers([]);
        }
      } else {
        console.log('[UserContext] No stickers data found in storage');
        setSavedStickers([]);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      console.log('[auth] Mock login for:', email);
      
      const mockUsersKey = '@mock_users';
      const storedUsers = await AsyncStorage.getItem(mockUsersKey);
      const users = storedUsers ? JSON.parse(storedUsers) : {};
      
      const userRecord = users[email.toLowerCase()];
      
      if (!userRecord || userRecord.password !== password) {
        throw new Error('Invalid credentials');
      }
      
      const authed: User = { 
        id: userRecord.id, 
        email: userRecord.email, 
        name: userRecord.name, 
        token: `mock_token_${Date.now()}` 
      };
      
      console.log('[auth] Saving user data to AsyncStorage...');
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authed));
      console.log('[auth] Setting user state...');
      setUser(authed);
      console.log('[auth] Setting auth token...');
      await setAuthToken(authed.token);
      console.log('[auth] Login process completed successfully');
    } catch (error: any) {
      console.error('[auth] Error logging in:', error);
      
      if (error?.message?.includes('Invalid')) {
        throw new Error('Invalid credentials');
      } else {
        throw new Error(error?.message || 'Login failed. Please try again.');
      }
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name?: string) => {
    try {
      console.log('[auth] Mock signup for:', email);
      
      const mockUsersKey = '@mock_users';
      const storedUsers = await AsyncStorage.getItem(mockUsersKey);
      const users = storedUsers ? JSON.parse(storedUsers) : {};
      
      const emailLower = email.toLowerCase();
      
      if (users[emailLower]) {
        throw new Error('Email already in use');
      }
      
      const newUser = {
        id: `user_${Date.now()}`,
        email: email,
        name: name || email.split('@')[0],
        password: password
      };
      
      users[emailLower] = newUser;
      await AsyncStorage.setItem(mockUsersKey, JSON.stringify(users));
      
      const authed: User = { 
        id: newUser.id, 
        email: newUser.email, 
        name: newUser.name, 
        token: `mock_token_${Date.now()}` 
      };
      
      console.log('[auth] Saving user data to AsyncStorage...');
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authed));
      console.log('[auth] Setting user state...');
      setUser(authed);
      console.log('[auth] Setting auth token...');
      await setAuthToken(authed.token);
      console.log('[auth] Signup process completed successfully');
    } catch (error: any) {
      console.error('[auth] Error signing up:', error);
      
      if (error?.message?.includes('already in use')) {
        throw new Error('Email already in use');
      } else {
        throw new Error(error?.message || 'Signup failed. Please try again.');
      }
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const metadataStr = await AsyncStorage.getItem(STICKERS_STORAGE_KEY);
      if (metadataStr) {
        const metadata: StickerMetadata[] = JSON.parse(metadataStr);
        if (Platform.OS === 'web') {
          await clearAllImagesFromIndexedDB();
        } else {
          await Promise.all(
            metadata.flatMap(m => [
              deleteImageFile(m.originalImagePath),
              deleteImageFile(m.stickerImagePath),
            ])
          );
        }
      }
      
      await AsyncStorage.multiRemove([USER_STORAGE_KEY, STICKERS_STORAGE_KEY]);
      setUser(null);
      await clearAuthToken();
      setSavedStickers([]);
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  }, []);

  const saveSticker = useCallback(async (originalImage: string, stickerImage: string, title?: string) => {
    if (!user) {
      console.warn('[UserContext] Cannot save sticker: user not logged in');
      return;
    }
    
    if (!originalImage || !stickerImage) {
      console.error('[UserContext] Cannot save sticker: empty image URIs');
      throw new Error('Invalid image data');
    }

    try {
      const stickerId = Date.now().toString();
      console.log('[UserContext] Saving sticker:', stickerId);

      const processedStickerDataUri = stickerImage;
      const size = await getImageSizeFromDataUri(processedStickerDataUri);
      console.log('[UserContext] Sticker size:', size.width, 'x', size.height);
      
      const newSticker: SavedSticker = {
        id: stickerId,
        originalImage,
        stickerImage: processedStickerDataUri,
        createdAt: new Date().toISOString(),
        title,
        imageWidth: size.width,
        imageHeight: size.height,
      };

      const updatedStickers = [newSticker, ...savedStickers];
      setSavedStickers(updatedStickers);
      console.log('[UserContext] Updated stickers list, total:', updatedStickers.length);
      
      if (storageTimeoutRef.current) {
        clearTimeout(storageTimeoutRef.current);
      }
      
      storageTimeoutRef.current = setTimeout(async () => {
        try {
          console.log('[UserContext] Persisting sticker to storage...');
          const originalBase64 = extractBase64FromDataUri(originalImage);
          const stickerBase64 = extractBase64FromDataUri(processedStickerDataUri);
          
          if (!originalBase64 || !stickerBase64) {
            throw new Error('Failed to extract base64 data from images');
          }
          
          console.log('[UserContext] Base64 data extracted, original size:', originalBase64.length, 'sticker size:', stickerBase64.length);
          
          const [originalImagePath, stickerImagePath] = await Promise.all([
            saveImageToFile(originalBase64, `${stickerId}_original.png`),
            saveImageToFile(stickerBase64, `${stickerId}_sticker.png`),
          ]);

          const metadata: StickerMetadata = {
            id: stickerId,
            originalImagePath,
            stickerImagePath,
            createdAt: newSticker.createdAt,
            title,
            imageWidth: newSticker.imageWidth,
            imageHeight: newSticker.imageHeight,
          };

          const existingMetadata = await AsyncStorage.getItem(STICKERS_STORAGE_KEY);
          const metadataArray: StickerMetadata[] = existingMetadata 
            ? JSON.parse(existingMetadata) 
            : [];
          
          metadataArray.unshift(metadata);
          await AsyncStorage.setItem(STICKERS_STORAGE_KEY, JSON.stringify(metadataArray));
          console.log('[UserContext] Sticker successfully persisted to storage');
        } catch (error) {
          console.error('[UserContext] Error persisting sticker:', error);
          setSavedStickers(prev => prev.filter(s => s.id !== stickerId));
          throw error;
        }
      }, 100);
    } catch (error) {
      console.error('[UserContext] Error saving sticker:', error);
      throw error;
    }
  }, [user, savedStickers]);

  const deleteSticker = useCallback(async (stickerId: string) => {
    try {
      const metadataStr = await AsyncStorage.getItem(STICKERS_STORAGE_KEY);
      if (metadataStr) {
        const metadata: StickerMetadata[] = JSON.parse(metadataStr);
        const stickerMetadata = metadata.find(m => m.id === stickerId);
        
        if (stickerMetadata) {
          await Promise.all([
            deleteImageFile(stickerMetadata.originalImagePath),
            deleteImageFile(stickerMetadata.stickerImagePath),
          ]);
        }
        
        const updatedMetadata = metadata.filter(m => m.id !== stickerId);
        await AsyncStorage.setItem(STICKERS_STORAGE_KEY, JSON.stringify(updatedMetadata));
      }
      
      const updatedStickers = savedStickers.filter(sticker => sticker.id !== stickerId);
      setSavedStickers(updatedStickers);
    } catch (error) {
      console.error('Error deleting sticker:', error);
      throw error;
    }
  }, [savedStickers]);

  const refreshStickers = useCallback(async () => {
    await loadUserData();
  }, [loadUserData]);
  
  const getStickerById = useCallback(async (stickerId: string): Promise<SavedSticker | null> => {
    try {
      const sticker = savedStickers.find(s => s.id === stickerId);
      if (sticker) {
        return sticker;
      }
      
      const stored = await AsyncStorage.getItem(STICKERS_STORAGE_KEY);
      if (stored) {
        const metadataResult = safeJsonParse<StickerMetadata[]>(stored);
        if (metadataResult.success && Array.isArray(metadataResult.data)) {
          const metadata = metadataResult.data.find(m => m.id === stickerId);
          if (metadata) {
            const [originalImage, stickerImage] = await Promise.all([
              readImageFromFile(metadata.originalImagePath),
              readImageFromFile(metadata.stickerImagePath),
            ]);
            return {
              id: metadata.id,
              originalImage,
              stickerImage,
              createdAt: metadata.createdAt,
              title: metadata.title,
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting sticker by ID:', error);
      return null;
    }
  }, [savedStickers]);

  const updateSticker = useCallback(async (stickerId: string, newStickerImage: string) => {
    try {
      const updatedStickers = savedStickers.map(sticker => 
        sticker.id === stickerId 
          ? { ...sticker, stickerImage: newStickerImage }
          : sticker
      );
      
      setSavedStickers(updatedStickers);
      
      const metadataStr = await AsyncStorage.getItem(STICKERS_STORAGE_KEY);
      if (metadataStr) {
        const metadata: StickerMetadata[] = JSON.parse(metadataStr);
        const stickerMetadata = metadata.find(m => m.id === stickerId);
        
        if (stickerMetadata) {
          await deleteImageFile(stickerMetadata.stickerImagePath);
          
          const stickerBase64 = extractBase64FromDataUri(newStickerImage);
          const newStickerImagePath = await saveImageToFile(
            stickerBase64,
            `${stickerId}_sticker.png`
          );
          
          // try to update size metadata as well
          const newSize = await getImageSizeFromDataUri(newStickerImage);
          stickerMetadata.stickerImagePath = newStickerImagePath;
          stickerMetadata.imageWidth = newSize.width;
          stickerMetadata.imageHeight = newSize.height;
          await AsyncStorage.setItem(STICKERS_STORAGE_KEY, JSON.stringify(metadata));
        }
      }
    } catch (error) {
      console.error('Error updating sticker:', error);
      await loadUserData();
      throw error;
    }
  }, [savedStickers, loadUserData]);

  const contextValue = useMemo(() => ({
    user,
    savedStickers,
    isLoading,
    login,
    signup,
    logout,
    saveSticker,
    deleteSticker,
    refreshStickers,
    getStickerById,
    updateSticker
  }), [user, savedStickers, isLoading, login, signup, logout, saveSticker, deleteSticker, refreshStickers, getStickerById, updateSticker]);

  return contextValue;
});