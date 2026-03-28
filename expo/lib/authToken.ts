import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = '@auth_token';
let authToken: string | undefined;

// Initialize token from storage on app start
let isInitialized = false;

const initializeToken = async () => {
  if (isInitialized) return;
  try {
    const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (storedToken) {
      authToken = storedToken;
      console.log('[authToken] Token loaded from storage');
    }
  } catch (error) {
    console.error('[authToken] Error loading token from storage:', error);
  }
  isInitialized = true;
};

// Initialize immediately
initializeToken();

export async function setAuthToken(token: string | undefined) {
  console.log('[authToken] setAuthToken called with token:', !!token);
  authToken = token;
  
  try {
    if (token) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
      console.log('[authToken] Token saved to storage');
    } else {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      console.log('[authToken] Token removed from storage');
    }
  } catch (error) {
    console.error('[authToken] Error saving token to storage:', error);
  }
}

export function getAuthToken(): string | undefined {
  return authToken;
}

export async function clearAuthToken() {
  console.log('[authToken] clearAuthToken called');
  authToken = undefined;
  try {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    console.log('[authToken] Token cleared from storage');
  } catch (error) {
    console.error('[authToken] Error clearing token from storage:', error);
  }
}
