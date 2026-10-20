import { Tabs } from "expo-router";
import { Briefcase, Home, Package, ShoppingCart, Users } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { warmSellingData } from "../../constants/warm-up";
import { useAuth } from "../../context/auth-context";
import { useTheme } from "../../context/theme-context";



export default function TabLayout() {
const { colors } = useTheme();
const { isSessionReady, isBusinessReady, businessId, role, isOffline } = useAuth();
const warmedRef = useRef<string | null>(null);

useEffect(() => {
  if (!businessId || !role || isOffline) return;
  const key = `${businessId}:${role}`;
  if (warmedRef.current === key) return;
  const timer = setTimeout(() => {
    warmedRef.current = key;
    void warmSellingData(businessId, role);
  }, 3000);
  return () => clearTimeout(timer);
}, [businessId, role, isOffline]);

  if (!isSessionReady || !isBusinessReady) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
          backgroundColor: colors.tabBarBackground,
          borderTopWidth: 1,
          borderTopColor: colors.tabBarBorder,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: "Jobs",
          tabBarIcon: ({ color }) => <Briefcase size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: "Sales",
          tabBarIcon: ({ color }) => <ShoppingCart size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="catalogue"
        options={{
          title: "Catalogue",
          tabBarIcon: ({ color }) => <Package size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: "Customers",
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
