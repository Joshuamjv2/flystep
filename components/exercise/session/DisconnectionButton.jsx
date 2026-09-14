// components/exercise/session/DisconnectButton.jsx
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ThemedText from "../../ThemedText";
import { t } from "../../../constants/translations";
import { useAuth } from "../../../hooks/useAuth";

export default function DisconnectButton({ theme, onDisconnect }) {
  const { language } = useAuth();

  return (
    <Pressable
      onPress={onDisconnect}
      style={[styles.btn, { borderColor: theme.border }]}
    >
      <Ionicons name="bluetooth-outline" size={14} color={theme.subtleText} />
      <ThemedText style={[styles.text, { color: theme.subtleText }]}>
        {t[language]?.ex_disconnect_device || t.en.ex_disconnect_device}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  text: { fontSize: 13 },
});
