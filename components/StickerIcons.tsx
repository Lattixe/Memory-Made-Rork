import React from 'react';
import { View, StyleSheet } from 'react-native';
import { 
  Camera, 
  Image as ImageIcon, 
  Calendar,
  Heart,
  Cloud,
  ShoppingCart,
  FileText,
  Sparkles
} from 'lucide-react-native';
import { memoryMadeColors } from '@/constants/colors';

interface StickerIconProps {
  type: 'camera' | 'image' | 'calendar' | 'heart' | 'cloud' | 'cart' | 'note' | 'sparkles';
  size?: number;
  color?: string;
  backgroundColor?: string;
}

export function StickerIcon({ 
  type, 
  size = 24, 
  color = memoryMadeColors.primary,
  backgroundColor = memoryMadeColors.peach 
}: StickerIconProps) {
  const iconSize = size * 0.6;
  
  const IconComponent = {
    camera: Camera,
    image: ImageIcon,
    calendar: Calendar,
    heart: Heart,
    cloud: Cloud,
    cart: ShoppingCart,
    note: FileText,
    sparkles: Sparkles,
  }[type];

  return (
    <View style={[
      styles.stickerIcon,
      {
        width: size,
        height: size,
        backgroundColor,
        transform: [{ rotate: `${Math.random() * 10 - 5}deg` }],
      }
    ]}>
      <IconComponent size={iconSize} color={color} strokeWidth={2} />
    </View>
  );
}

interface FloatingStickerProps {
  children: React.ReactNode;
  position: { top?: number; bottom?: number; left?: number; right?: number };
  rotation?: number;
}

export function FloatingSticker({ children, position, rotation = 0 }: FloatingStickerProps) {
  return (
    <View style={[
      styles.floatingSticker,
      position,
      { transform: [{ rotate: `${rotation}deg` }] }
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stickerIcon: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: memoryMadeColors.shadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: memoryMadeColors.white,
  },
  floatingSticker: {
    position: 'absolute',
    zIndex: 1,
  },
});