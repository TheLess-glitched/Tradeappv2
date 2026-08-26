import { Tabs } from "expo-router";
import { Briefcase, Grid2x2, Home, Package, Users } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#F6A623",
        tabBarInactiveTintColor: "#718096",
        tabBarStyle: {
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
          backgroundColor: "#0A0F1E",
          borderTopWidth: 1,
          borderTopColor: "#1E2A3D",
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
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color }) => <Grid2x2 size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
