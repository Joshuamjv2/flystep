// components/exercise/session/StickyActions.jsx
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ThemedText from "../../ThemedText";
import { Colors } from "../../../constants/Colors";
import { t } from "../../../constants/translations";
import { useAuth } from "../../../hooks/useAuth";

export default function StickyActions({
  theme,
  active,
  paused,
  canStart,
  selectedActivity,
  selectedSubActivity,
  onStart,
  onStop,
  onResume,
  onExit,
}) {
  const { language } = useAuth();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.background, borderTopColor: theme.border },
      ]}
    >
      {active ? (
        <>
          {paused ? (
            <Pressable
              onPress={onResume}
              style={[styles.btn, { backgroundColor: Colors.primary, flex: 1 }]}
            >
              <Ionicons name="play-circle-outline" size={16} color="#fff" />
              <ThemedText style={styles.btnText}>
                {t[language]?.resume || t.en.resume}
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              onPress={onStop}
              style={[styles.btn, { backgroundColor: Colors.warning, flex: 1 }]}
            >
              <Ionicons name="stop-circle-outline" size={16} color="#fff" />
              <ThemedText style={styles.btnText}>
                {t[language]?.stop || t.en.stop}
              </ThemedText>
            </Pressable>
          )}
          <Pressable
            onPress={onExit}
            style={[
              styles.btn,
              {
                backgroundColor: theme.uiBackground,
                borderColor: theme.border,
                borderWidth: 1,
                flex: 1,
              },
            ]}
          >
            <Ionicons name="close-outline" size={16} color={theme.text} />
            <ThemedText style={[styles.btnText, { color: theme.text }]}>
              {t[language]?.exit || t.en.exit}
            </ThemedText>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={onStart}
          disabled={!canStart}
          style={[
            styles.btn,
            {
              flex: 1,
              backgroundColor: canStart ? Colors.primary : theme.border,
              opacity: canStart ? 1 : 0.6,
            },
          ]}
        >
          <Ionicons name="play-circle-outline" size={16} color="#fff" />
          <ThemedText style={styles.btnText}>
            {!selectedActivity
              ? t[language]?.ex_select_activity || t.en.ex_select_activity
              : !selectedSubActivity
                ? t[language]?.ex_select_sub_activity ||
                  t.en.ex_select_sub_activity
                : t[language]?.start || t.en.start}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
