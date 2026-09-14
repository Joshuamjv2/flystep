import { StyleSheet, Text, View, AppState } from "react-native";
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { useColorScheme } from "react-native";
import { Colors } from "../constants/Colors";
import { UserProvider } from "../contexts/authContext";
import { BluetoothProvider } from "../contexts/bluetoothContext";
import {
  QueryClientProvider,
  QueryClient,
  focusManager,
} from "@tanstack/react-query";
import { setupGlobalBLEErrorHandling } from "../utils/bleErrorHandler";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 30000,
    },
  },
});

const RootLayout = () => {
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? "light";
  const theme = Colors[scheme];

  // Initialize global BLE error handling once
  useEffect(() => {
    setupGlobalBLEErrorHandling();
  }, []);

  // 👇 Tell React Query when the app gains/loses focus
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        focusManager.setFocused(true);
      } else {
        focusManager.setFocused(false);
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <BluetoothProvider>
          <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.navBackground },
              headerTintColor: theme.title,
            }}
          >
            <Stack.Screen name="index" options={{ title: "Previo" }} />
            <Stack.Screen options={{ headerShown: false }} name="(auth)" />
            <Stack.Screen options={{ headerShown: false }} name="(dashboard)" />
          </Stack>
        </BluetoothProvider>
      </UserProvider>
    </QueryClientProvider>
  );
};

export default RootLayout;

const styles = StyleSheet.create({});
