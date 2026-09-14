import { Tabs } from "expo-router";
import { useColorScheme, Image, View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import UserOnly from "../../components/auth/UserOnly";
import { Colors } from "../../constants/Colors";
import Logo from "../../assets/seere/previo-long.png";
import ThemedView from "../../components/ThemedView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../../constants/translations";
import { useAuth } from "../../hooks/useAuth";

const DashboardLayout = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  const { language } = useAuth();

  // 🔌 Dummy BLE state
  const isConnected = true;
  const batteryLevel = 82;

  return (
    <UserOnly>

      {/* 📱 Tabs */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.navBackground,
            paddingTop: 4,
            height: 90,
          },
          tabBarActiveTintColor: theme.iconColorFocused,
          tabBarInactiveTintColor: theme.iconColor,
        }}
      >
        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ focused }) => (
              <Ionicons
                size={24}
                name={focused ? "person" : "person-outline"}
                color={focused ? theme.iconColorFocused : theme.iconColor}
              />
            ),
            headerShown: false,
            title: t[language]?.tab_home || t.en.tab_home,
          }}
        />
        <Tabs.Screen
          name="exercise"
          options={{
            tabBarIcon: ({ focused }) => (
              <Ionicons
                size={24}
                name={focused ? "barbell" : "barbell-outline"}
                color={focused ? theme.iconColorFocused : theme.iconColor}
              />
            ),
            headerShown: false,
            title: t[language]?.tab_exercise || t.en.tab_exercise,
          }}
        />
        <Tabs.Screen
          name="diagnostics"
          options={{
            tabBarIcon: ({ focused }) => (
              <Ionicons
                size={24}
                name={focused ? "pulse" : "pulse-outline"}
                color={focused ? theme.iconColorFocused : theme.iconColor}
              />
            ),
            headerShown: false,
            title: t[language]?.tab_diagnostics || t.en.tab_diagnostics,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            tabBarIcon: ({ focused }) => (
              <Ionicons
                size={24}
                name={focused ? "settings" : "settings-outline"}
                color={focused ? theme.iconColorFocused : theme.iconColor}
              />
            ),
            headerShown: false,
            title: t[language]?.tab_settings || t.en.tab_settings,
          }}
        />
      </Tabs>
    </UserOnly>
  );
};

export default DashboardLayout;

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    border: "2px",
    borderColor: "white",
  },
  logo: {
    width: 120,
    height: 40,
    resizeMode: "contain",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  batteryContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
});
