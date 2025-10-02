import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { setAuthToken, clearAuthToken } from '@/lib/authToken';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { safeJsonParse } from '@/utils/json';
import * as FileSystem from 'expo-file-system';

export interface SavedSticker {
  id: string;
  originalImage: string;
  stickerImage: string;
  createdAt: string;
  title?: string;
}

interface StickerMetadata {
  id: string;
  originalImagePath: string;
  stickerImagePath: string;
  createdAt: string;
  title?: string;
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
const STICKERS_DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}stickers/` : '';

const ensureStickersDirectory = async () => {
  if (Platform.OS === 'web') return;
  const dirInfo = await FileSystem.getInfoAsync(STICKERS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(STICKERS_DIR, { intermediates: true });
  }
};

const saveImageToFile = async (base64Data: string, filename: string): Promise<string> => {
  if (Platform.OS === 'web') {
    return base64Data;
  }
  await ensureStickersDirectory();
  const filePath = `${STICKERS_DIR}${filename}`;
  await FileSystem.writeAsStringAsync(filePath, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return filePath;
};

const readImageFromFile = async (filePath: string): Promise<string> => {
  try {
    if (Platform.OS === 'web') {
      return `data:image/png;base64,${filePath}`;
    }
    const base64 = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('Error reading image from file:', error);
    throw error;
  }
};

const deleteImageFile = async (filePath: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') return;
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
          const loadedStickers = await Promise.all(
            stickersResult.data.map(async (metadata) => {
              try {
                const [originalImage, stickerImage] = await Promise.all([
                  readImageFromFile(metadata.originalImagePath),
                  readImageFromFile(metadata.stickerImagePath),
                ]);
                const sticker: SavedSticker = {
                  id: metadata.id,
                  originalImage,
                  stickerImage,
                  createdAt: metadata.createdAt,
                  title: metadata.title,
                };
                return sticker;
              } catch (error) {
                console.error(`Error loading sticker ${metadata.id}:`, error);
                return null;
              }
            })
          );
          setSavedStickers(loadedStickers.filter((s): s is SavedSticker => s !== null));
        } else {
          console.warn('Invalid stickers data format, clearing storage:', stickersResult.error);
          await AsyncStorage.removeItem(STICKERS_STORAGE_KEY);
          setSavedStickers([]);
        }
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
        await Promise.all(
          metadata.flatMap(m => [
            deleteImageFile(m.originalImagePath),
            deleteImageFile(m.stickerImagePath),
          ])
        );
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
    if (!user) return;

    try {
      const stickerId = Date.now().toString();
      
      const newSticker: SavedSticker = {
        id: stickerId,
        originalImage,
        stickerImage,
        createdAt: new Date().toISOString(),
        title
      };

      // Optimistic update for immediate UI response
      const updatedStickers = [newSticker, ...savedStickers];
      setSavedStickers(updatedStickers);
      
      // Save images to file system in background
      if (storageTimeoutRef.current) {
        clearTimeout(storageTimeoutRef.current);
      }
      
      storageTimeoutRef.current = setTimeout(async () => {
        try {
          const originalBase64 = extractBase64FromDataUri(originalImage);
          const stickerBase64 = extractBase64FromDataUri(stickerImage);
          
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
          };

          const existingMetadata = await AsyncStorage.getItem(STICKERS_STORAGE_KEY);
          const metadataArray: StickerMetadata[] = existingMetadata 
            ? JSON.parse(existingMetadata) 
            : [];
          
          metadataArray.unshift(metadata);
          await AsyncStorage.setItem(STICKERS_STORAGE_KEY, JSON.stringify(metadataArray));
        } catch (error) {
          console.error('Error persisting sticker:', error);
          setSavedStickers(prev => prev.filter(s => s.id !== stickerId));
          throw error;
        }
      }, 100);
    } catch (error) {
      console.error('Error saving sticker:', error);
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
          
          stickerMetadata.stickerImagePath = newStickerImagePath;
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