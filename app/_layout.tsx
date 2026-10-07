import { router, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { ActivityIndicator, AppState, Linking, Text, TouchableOpacity, View } from "react-native";
import { AppFeedbackProvider, showToast } from "../components/app-feedback";
import { supabase } from "../constants/supabase";
import { AuthProvider, useAuth } from "../context/auth-context";
import { CartProvider } from "../context/cart-context";
import { ThemeProvider, useTheme } from "../context/theme-context";

function RootNavigator() {
  const { colors, isDark, isPinUnlocked, pinUnlockedUserId, setPinUnlocked } = useTheme();
  const pathname = usePathname();
  const lastRefreshAt = useRef(0);
  const {
    isSignedIn,
    user,
    isBusinessReady,
    businessError,
    role,
    refreshBusiness,
  } = useAuth();
  const isRouteAccessibleBeforePin =
    pathname === "/join-business" ||
    pathname === "/pin" ||
    pathname === "/" ||
    pathname === "/signup";
  const isNoBusinessRoute = pathname === "/no-business";
  const pinGateActive =
    isSignedIn &&
    (!isPinUnlocked || pinUnlockedUserId !== user?.id) &&
    !isRouteAccessibleBeforePin;
  const noBusinessGateActive =
    isSignedIn &&
    isBusinessReady &&
    !businessError &&
    role === null &&
    isPinUnlocked &&
    pinUnlockedUserId === user?.id &&
    !isNoBusinessRoute &&
    pathname !== "/join-business" &&
    pathname !== "/pin" &&
    pathname !== "/";

  useEffect(() => {
    if (pinGateActive) {
      router.replace("/pin" as any);
    }
  }, [pinGateActive]);

  useEffect(() => {
    if (noBusinessGateActive && !pinGateActive) {
      router.replace("/no-business" as any);
    }
  }, [noBusinessGateActive, pinGateActive]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const now = Date.now();
      if (
        nextState === "active" &&
        isSignedIn &&
        now - lastRefreshAt.current >= 60_000
      ) {
        lastRefreshAt.current = now;
        void refreshBusiness();
      }
    });

    return () => subscription.remove();
  }, [isSignedIn, refreshBusiness]);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showToast("Couldn't sign out", error.message);
      return;
    }
    setPinUnlocked(false);
    router.replace("/");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {pinGateActive || (isSignedIn && !isBusinessReady) ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isSignedIn && businessError && !role ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            backgroundColor: colors.background,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700", marginBottom: 12 }}>
            Couldn&apos;t connect
          </Text>
          <TouchableOpacity
            onPress={() => {
              void refreshBusiness();
            }}
            style={{
              width: "100%",
              alignItems: "center",
              padding: 14,
              borderRadius: 12,
              backgroundColor: colors.primary,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={signOut}
            style={{
              width: "100%",
              alignItems: "center",
              padding: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Sign out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="pin" />
          <Stack.Screen name="no-business" />
          <Stack.Screen name="inventory" />
          <Stack.Screen name="catalogue-detail" />
          <Stack.Screen name="new-job" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="team" />
          <Stack.Screen name="join-business" />
          <Stack.Screen name="daily-close" />
          <Stack.Screen name="notes" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modal" />
        </Stack>
      )}
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
      <CartProvider>
        <ThemeProvider>
          <AppFeedbackProvider>
            <RootNavigator />
          </AppFeedbackProvider>
        </ThemeProvider>
      </CartProvider>
    </AuthProvider>
  );
}
