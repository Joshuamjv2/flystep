// components/exercise/session/SessionHeader.jsx
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ThemedText from "../../ThemedText";
import { Colors } from "../../../constants/Colors";
import { t } from "../../../constants/translations";
import { useAuth } from "../../../hooks/useAuth";

export default function SessionHeader({
  device,
  theme,
  isRealDevice,
  onBackPress,
}) {
  const { language } = useAuth();

  return (
    <View style={styles.header}>
      <Pressable onPress={onBackPress} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={theme.iconColor} />
      </Pressable>

      <ThemedText
        title
        style={[styles.headerTitle, { color: theme.title }]}
        numberOfLines={1}
      >
        {device?.name}
      </ThemedText>

      <View style={styles.connectionBadge}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: isRealDevice
                ? Colors.secondary
                : theme.subtleText,
            },
          ]}
        />
        <ThemedText style={[styles.statusText, { color: theme.subtleText }]}>
          {isRealDevice
            ? t[language]?.ex_connected || t.en.ex_connected
            : t[language]?.ex_simulated || t.en.ex_simulated}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 10,
    gap: 8,
  },
  backButton: { padding: 6 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
  connectionBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12 },
});
