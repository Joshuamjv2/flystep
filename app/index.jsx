import { useContext, useEffect } from "react";
import { ActivityIndicator } from "react-native";
import { useAuth } from "../hooks/useAuth";
import { router } from "expo-router";
import ThemedView from "../components/ThemedView";

export default function Index() {
  const { user, authChecked } = useAuth();

  useEffect(() => {
    if (!authChecked) return; // still initializing

    if (user) {
      router.replace("/profile");
    } else {
      router.replace("/login");
    }
  }, [authChecked, user]);

  return (
    <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </ThemedView>
  );
}
