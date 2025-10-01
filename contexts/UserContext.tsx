import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { setAuthToken, clearAuthToken } from '@/lib/authToken';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { safeJsonParse } from '@/utils/json';

export interface SavedSticker {
  id: string;
  originalImage: string;
  stickerImage: string;
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
        const stickersResult = safeJsonParse<SavedSticker[]>(stickersData);
        if (stickersResult.success && Array.isArray(stickersResult.data)) {
          setSavedStickers(stickersResult.data);
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
      await AsyncStorage.multiRemove([USER_STORAGE_KEY, STICKERS_STORAGE_KEY]);
      setUser(null);
      await clearAuthToken();
      setSavedStickers([]);
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  }, []);

  const saveSticker = useCallback(async (originalImage: string, stickerImage: string, title?: string) => {
    if (!user) return;

    try {
      const newSticker: SavedSticker = {
        id: Date.now().toString(),
        originalImage,
        stickerImage,
        createdAt: new Date().toISOString(),
        title
      };

      // Optimistic update for immediate UI response
      const updatedStickers = [newSticker, ...savedStickers];
      setSavedStickers(updatedStickers);
      
      // Debounce storage operation to prevent blocking
      if (storageTimeoutRef.current) {
        clearTimeout(storageTimeoutRef.current);
      }
      
      storageTimeoutRef.current = setTimeout(async () => {
        try {
          await AsyncStorage.setItem(STICKERS_STORAGE_KEY, JSON.stringify(updatedStickers));
        } catch (error) {
          console.error('Error persisting sticker:', error);
          // Revert optimistic update on failure
          setSavedStickers(prev => prev.filter(s => s.id !== newSticker.id));
        }
      }, 100);
    } catch (error) {
      console.error('Error saving sticker:', error);
      throw error;
    }
  }, [user, savedStickers]);

  const deleteSticker = useCallback(async (stickerId: string) => {
    try {
      const updatedStickers = savedStickers.filter(sticker => sticker.id !== stickerId);
      await AsyncStorage.setItem(STICKERS_STORAGE_KEY, JSON.stringify(updatedStickers));
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
      // First check in current state
      const sticker = savedStickers.find(s => s.id === stickerId);
      if (sticker) {
        return sticker;
      }
      
      // If not found in state, check AsyncStorage directly
      const stored = await AsyncStorage.getItem(STICKERS_STORAGE_KEY);
      if (stored) {
        const stickersResult = safeJsonParse<SavedSticker[]>(stored);
        if (stickersResult.success && Array.isArray(stickersResult.data)) {
          return stickersResult.data.find(s => s.id === stickerId) || null;
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
      
      // Optimistic update
      setSavedStickers(updatedStickers);
      
      // Persist to storage
      await AsyncStorage.setItem(STICKERS_STORAGE_KEY, JSON.stringify(updatedStickers));
    } catch (error) {
      console.error('Error updating sticker:', error);
      // Revert on failure
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