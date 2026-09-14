// components/exercise/session/AthleteDropdown.jsx
//
// Modal-based athlete picker. The previous absolute-positioned approach
// placed the dropdown inside the parent ScrollView, which intercepted
// touch events before they reached the list items — making it impossible
// to scroll or tap items reliably. A Modal renders above everything in
// the React tree, completely outside the ScrollView's touch zone.

import {
  View,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useState, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import ThemedText from "../../ThemedText";
import { Colors } from "../../../constants/Colors";
import { t } from "../../../constants/translations";
import { useAuth } from "../../../hooks/useAuth";

export default function AthleteDropdown({
  theme,
  chips,
  selectedId,
  onSelect,
  label,
  warn,
}) {
  const { language } = useAuth();
  const [open, setOpen] = useState(false);
  // Measure the trigger button so the modal dropdown appears directly below it
  const [triggerLayout, setTriggerLayout] = useState(null);
  const triggerRef = useRef(null);
  const { width } = useWindowDimensions();

  const selectedChip = chips.find((c) => c.id === selectedId);

  const measureTrigger = () => {
    if (triggerRef.current) {
      triggerRef.current.measureInWindow((x, y, w, h) => {
        setTriggerLayout({ x, y, width: w, height: h });
        setOpen(true);
      });
    }
  };

  return (
    <View style={styles.selectorSection}>
      <View
        style={[
          warn &&
            !selectedId && {
              borderWidth: 1.5,
              borderColor: Colors.warning,
              borderRadius: 12,
              padding: 6,
            },
        ]}
      >
        <ThemedText
          style={[
            styles.selectorLabel,
            { color: warn && !selectedId ? Colors.warning : theme.subtleText },
          ]}
        >
          {warn && !selectedId
            ? `⚠ ${t[language]?.ex_select_athlete_warn || t.en.ex_select_athlete_warn}`
            : label}
        </ThemedText>

        {/* Trigger button — measured so modal aligns below it */}
        <Pressable
          ref={triggerRef}
          onPress={measureTrigger}
          style={[
            styles.triggerButton,
            {
              backgroundColor: theme.accentSurface,
              borderColor: warn && !selectedId ? Colors.warning : theme.border,
            },
          ]}
        >
          <View style={styles.triggerLeft}>
            {selectedChip?.avatar ? (
              <View
                style={[styles.avatar, { backgroundColor: Colors.primary }]}
              >
                <ThemedText style={styles.avatarText}>
                  {selectedChip.avatar}
                </ThemedText>
              </View>
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.border }]}>
                <Ionicons
                  name="person-outline"
                  size={12}
                  color={theme.subtleText}
                />
              </View>
            )}
            <ThemedText
              numberOfLines={1}
              style={[
                styles.triggerText,
                { color: selectedChip ? theme.text : theme.subtleText },
              ]}
            >
              {selectedChip?.label ??
                (t[language]?.ex_select_athlete || t.en.ex_select_athlete)}
            </ThemedText>
          </View>

          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={18}
            color={warn && !selectedId ? Colors.warning : theme.subtleText}
          />
        </Pressable>
      </View>

      {/* ── Modal dropdown ─────────────────────────────────────────────────
          Rendered outside the ScrollView entirely so touch events are not
          intercepted by the parent scroll view. Aligned directly below the
          trigger button using measureInWindow coordinates.               */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        {/* Full-screen backdrop — tap anywhere outside to close */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Stop propagation so taps inside the list don't close it */}
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.dropdownPanel,
              {
                backgroundColor: theme.uiBackground,
                borderColor: theme.border,
                // Position directly below the trigger
                top: triggerLayout
                  ? triggerLayout.y + triggerLayout.height + 4
                  : 120,
                left: triggerLayout ? triggerLayout.x : 16,
                width: triggerLayout ? triggerLayout.width : width - 32,
              },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              bounces={false}
              style={{ maxHeight: 280 }}
              contentContainerStyle={{ paddingVertical: 4 }}
            >
              {chips.length === 0 ? (
                <ThemedText
                  style={[styles.emptyText, { color: theme.subtleText }]}
                >
                  {t[language]?.ex_no_team_members || t.en.ex_no_team_members}
                </ThemedText>
              ) : (
                chips.map((chip) => {
                  const isSelected = selectedId === chip.id;
                  return (
                    <Pressable
                      key={chip.id}
                      onPress={() => {
                        onSelect(chip);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.item,
                        {
                          backgroundColor: isSelected
                            ? Colors.primary
                            : pressed
                              ? theme.accentSurface
                              : theme.uiBackground,
                          borderBottomColor: theme.border,
                        },
                      ]}
                    >
                      <View style={styles.itemLeft}>
                        {chip.avatar ? (
                          <View
                            style={[
                              styles.avatar,
                              {
                                backgroundColor: isSelected
                                  ? "rgba(255,255,255,0.25)"
                                  : theme.border,
                              },
                            ]}
                          >
                            <ThemedText
                              style={[
                                styles.avatarText,
                                {
                                  color: isSelected ? "#fff" : theme.subtleText,
                                },
                              ]}
                            >
                              {chip.avatar}
                            </ThemedText>
                          </View>
                        ) : null}
                        <ThemedText
                          numberOfLines={1}
                          style={[
                            styles.itemText,
                            { color: isSelected ? "#fff" : theme.text },
                          ]}
                        >
                          {chip.label}
                        </ThemedText>
                      </View>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color="#fff"
                        />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  triggerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  triggerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  triggerText: { fontSize: 14, fontWeight: "600", flex: 1 },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 9, fontWeight: "700", color: "#fff" },

  // ── Modal overlay ─────────────────────────────────────────────────────────
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  dropdownPanel: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  itemText: { fontSize: 14, fontWeight: "600", flex: 1 },
  emptyText: { fontSize: 13, padding: 14, textAlign: "center" },
});
