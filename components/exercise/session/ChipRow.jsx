// components/exercise/session/ChipRow.jsx
import { View, Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ThemedText from "../../ThemedText";
import { Colors } from "../../../constants/Colors";

export default function ChipRow({
  label,
  chips,
  selectedId,
  onSelect,
  theme,
  disabled = false,
}) {
  return (
    <View style={styles.selectorSection}>
      {label ? (
        <ThemedText style={[styles.selectorLabel, { color: theme.subtleText }]}>
          {label}
        </ThemedText>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {chips.map((chip) => {
          const isSelected = selectedId === chip.id;
          return (
            <Pressable
              key={chip.id}
              onPress={() => !disabled && onSelect(chip)}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected
                    ? Colors.primary
                    : theme.accentSurface,
                  borderColor: isSelected ? Colors.primary : theme.border,
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
            >
              {chip.avatar ? (
                <View
                  style={[
                    styles.chipAvatar,
                    {
                      backgroundColor: isSelected
                        ? "rgba(255,255,255,0.25)"
                        : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.chipAvatarText,
                      { color: isSelected ? "#fff" : theme.subtleText },
                    ]}
                  >
                    {chip.avatar}
                  </ThemedText>
                </View>
              ) : null}

              <ThemedText
                numberOfLines={1}
                style={[
                  styles.chipLabel,
                  { color: isSelected ? "#fff" : theme.text },
                ]}
              >
                {chip.label}
              </ThemedText>

              {isSelected && (
                <Ionicons name="checkmark-circle" size={13} color="#fff" />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  selectorSection: { marginBottom: 10 },
  selectorLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 7,
  },
  chipsRow: { gap: 8, paddingRight: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  chipAvatarText: { fontSize: 9, fontWeight: "700" },
  chipLabel: { fontSize: 13, fontWeight: "500", maxWidth: 150 },
});
