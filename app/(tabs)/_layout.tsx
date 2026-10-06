import { Tabs } from "expo-router";
import { Briefcase, Home, Package, ShoppingCart, Users } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../../context/auth-context";
import { useTheme } from "../../context/theme-context";

export default function TabLayout() {
  const { colors } = useTheme();
  const { isSessionReady, isBusinessReady } = useAuth();

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
