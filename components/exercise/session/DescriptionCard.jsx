// components/exercise/session/DescriptionCard.jsx
import { View, StyleSheet } from "react-native";
import ThemedText from "../../ThemedText";
import ThemedCard from "../../ThemedCard";
import { t } from "../../../constants/translations";
import { useAuth } from "../../../hooks/useAuth";

export default function DescriptionCard({ theme, selectedSubActivity }) {
  const { language } = useAuth();

  return (
    <ThemedCard
      style={[
        styles.card,
        {
          backgroundColor: theme.uiBackground,
          borderColor: theme.border,
          borderWidth: 1,
        },
      ]}
    >
      <View style={styles.inner}>
        <ThemedText style={[styles.text, { color: theme.text }]}>
          {selectedSubActivity?.description?.trim()
            ? selectedSubActivity.description
            : t[language]?.ex_no_description || t.en.ex_no_description}
        </ThemedText>
      </View>
    </ThemedCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  inner: {
    paddingVertical: 26,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    opacity: 0.9,
  },
});
