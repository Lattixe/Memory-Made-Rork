import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { UserProvider } from "@/contexts/UserContext";
import { StyleSheet } from "react-native";
import { trpc, trpcReactClient } from "@/lib/trpc";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

const RootLayoutNav = React.memo(() => {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="review" options={{ title: "Review Stickers", headerBackTitle: "Back" }} />
      <Stack.Screen name="checkout" options={{ title: "Checkout", headerBackTitle: "Back" }} />
      <Stack.Screen name="admin" options={{ title: "Admin Settings", headerBackTitle: "Back" }} />
      <Stack.Screen name="edit" options={{ headerShown: false }} />
      <Stack.Screen name="sticker-sheet" options={{ headerShown: false }} />
    </Stack>
  );
});
RootLayoutNav.displayName = 'RootLayoutNav';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

const RootLayout = () => {
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <trpc.Provider client={trpcReactClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <UserProvider>
          <GestureHandlerRootView style={styles.container}>
            <RootLayoutNav />
          </GestureHandlerRootView>
        </UserProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
};

export default RootLayout;
