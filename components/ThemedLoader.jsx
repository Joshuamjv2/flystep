import { Animated, StyleSheet, useColorScheme, View } from "react-native";
import { useEffect, useRef } from "react";
import { Colors } from "../constants/Colors";
import ThemedView from "./ThemedView";

const ThemedLogoLoader = ({ size = 90 }) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.03,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.85,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    pulse.start();
    return () => pulse.stop();
  }, [scaleAnim, opacityAnim]);

  return (
    <ThemedView style={styles.container}>
      {/* Logo */}
      <Animated.Image
        source={require("../assets/seere/previo.png")}
        resizeMode="contain"
        style={{
          width: size,
          height: size,
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        }}
      />
    </ThemedView>
  );
};

export default ThemedLogoLoader;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
