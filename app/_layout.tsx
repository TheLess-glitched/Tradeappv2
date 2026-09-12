import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Linking, View } from "react-native";
import { supabase } from "../constants/supabase";
import { AuthProvider } from "../context/auth-context";
import { ThemeProvider, useTheme } from "../context/theme-context";

function RootNavigator() {
  const { colors, isDark } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="pin" />
        <Stack.Screen name="inventory" />
        <Stack.Screen name="catalogue-detail" />
        <Stack.Screen name="new-job" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="daily-close" />
        <Stack.Screen name="explore" />
        <Stack.Screen name="notes" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      if (url.includes("access_token") || url.includes("confirmation")) {
        await supabase.auth.refreshSession();
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </AuthProvider>
  );
}
