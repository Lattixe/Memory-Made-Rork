import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { removeBackground } from '../utils/backgroundRemover';

interface MemoryMadeBrandingProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
}

export default function MemoryMadeBranding({ 
  size = 'medium', 
  showTagline = true 
}: MemoryMadeBrandingProps) {
  const [processedLogoUri, setProcessedLogoUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const originalLogoUri = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/wks84fpj5w46h7whowtc3';
  
  const logoSize = {
    small: { width: 180, height: 50 },
    medium: { width: 280, height: 80 },
    large: { width: 380, height: 110 },
  }[size];

  useEffect(() => {
    const processLogo = async () => {
      try {
        setIsLoading(true);
        
        // Fetch the image and convert to base64
        const response = await fetch(originalLogoUri);
        const blob = await response.blob();
        
        // Convert blob to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64Image = base64data.split(',')[1];
          
          try {
            // Remove background
            const processedImage = await removeBackground(base64Image);
            setProcessedLogoUri(`data:image/png;base64,${processedImage}`);
          } catch (error) {
            console.error('Failed to remove background, using original:', error);
            setProcessedLogoUri(originalLogoUri);
          }
          
          setIsLoading(false);
        };
        
        reader.onerror = () => {
          console.error('Failed to read image');
          setProcessedLogoUri(originalLogoUri);
          setIsLoading(false);
        };
        
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('Failed to process logo:', error);
        setProcessedLogoUri(originalLogoUri);
        setIsLoading(false);
      }
    };

    // Only process on web where we can use the background removal API
    if (Platform.OS === 'web') {
      processLogo();
    } else {
      // On mobile, use original logo
      setProcessedLogoUri(originalLogoUri);
      setIsLoading(false);
    }
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.container, logoSize]}>
        <ActivityIndicator size="small" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image 
        source={{ uri: processedLogoUri || originalLogoUri }}
        style={[styles.logo, logoSize]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  logo: {
    marginVertical: 8,
  },
});