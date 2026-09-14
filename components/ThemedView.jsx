import { View, useColorScheme } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Colors } from "../constants/Colors";

const ThemedView = ({ style, safe = false, safeTop = false, ...props }) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const insets = useSafeAreaInsets();

  // Safe only at the top
  if (safeTop) {
    return (
      <SafeAreaView
        style={[
          {
            backgroundColor: theme.background,
            paddingTop: insets.top,
          },
          style,
        ]}
        {...props}
      />
    );
  }

  // No safe area (default)
  if (!safe) {
    return (
      <View style={[{ backgroundColor: theme.background, padding: 0, margin: 0 }, style]} {...props} />
    );
  }

  // Full safe area
  return (
    <SafeAreaView
      style={[
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
        style,
      ]}
      {...props}
    />
  );
};

export default ThemedView;
