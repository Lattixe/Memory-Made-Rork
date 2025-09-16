export default {
  light: {
    text: '#2C2C2C',
    background: '#F9F4EA',
    tint: '#C97A4A',
    icon: '#8B7355',
    tabIconDefault: '#8B7355',
    tabIconSelected: '#C97A4A',
  },
  dark: {
    text: '#F9F4EA',
    background: '#2C2C2C',
    tint: '#E09B7D',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#E09B7D',
  },
};

export const memoryMadeColors = {
  // Brand colors
  primary: '#C97A4A', // Warm terracotta orange
  primaryLight: '#E09B7D',
  primaryDark: '#A85A2F',
  
  // Background colors
  cream: '#F9F4EA', // Main background
  white: '#FFFFFF',
  lightCream: '#FAF8F3',
  
  // Accent colors
  peach: '#F5C99B',
  sage: '#B8C5B0',
  dustyRose: '#D4A5A5',
  skyBlue: '#A8C4D4',
  lavender: '#C8B6DB',
  
  // Neutral colors
  gray50: '#FAFAF9',
  gray100: '#F5F5F4',
  gray200: '#E7E5E4',
  gray300: '#D6D3D1',
  gray400: '#A8A29E',
  gray500: '#78716C',
  gray600: '#57534E',
  gray700: '#44403C',
  gray800: '#292524',
  gray900: '#1C1917',
  
  // Status colors
  success: '#86B27B',
  warning: '#E8A557',
  error: '#D97B7B',
  
  // Text colors
  text: {
    primary: '#2C2C2C',
    secondary: '#6B6B6B',
    tertiary: '#9B9B9B',
    inverse: '#FFFFFF',
    brand: '#C97A4A',
  },
  
  // UI elements
  border: '#E8DFD3',
  borderLight: '#F0E9DF',
  surface: '#FFFFFF',
  surfaceLight: '#FAF8F3',
  shadow: 'rgba(139, 115, 85, 0.1)',
};

// Keep neutralColors for backward compatibility
export const neutralColors = {
  ...memoryMadeColors,
  background: memoryMadeColors.cream, // Add background property
};