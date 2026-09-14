import {
  useColorScheme,
  StyleSheet,
  TouchableOpacity,
  View,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, useCallback } from "react";
import ThemedView from "../../components/ThemedView";
import ThemedText from "../../components/ThemedText";
import ThemedCard from "../../components/ThemedCard";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../hooks/useAuth";
import { t } from "../../constants/translations";

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? "light";
  const theme = Colors[scheme];

  const { user, selectedTeam, handleSelectTeam, language, refreshUser } =
    useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // ✅ Auto-select first team if none selected
  useEffect(() => {
    if (!selectedTeam && user?.teams?.length > 0) {
      const first = user.teams[0];
      handleSelectTeam({
        id: first.team.id,
        name: first.team.name,
        role: first.role,
      });
    }
  }, [user, selectedTeam]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshUser();
    setRefreshing(false);
  }, [refreshUser]);

  return (
    <ThemedView safe style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* TEAMS SECTION */}
        <ThemedText title style={styles.sectionTitle}>
          {t[language]?.prof_my_teams || t.en.prof_my_teams}
        </ThemedText>

        {user?.teams?.length ? (
          user.teams.map((item) => {
            const isSelected = selectedTeam?.id === item.team.id;
            return (
              <TouchableOpacity
                key={item.team.id.toString()}
                onPress={() =>
                  handleSelectTeam({
                    id: item.team.id,
                    name: item.team.name,
                    role: item.role,
                  })
                }
                activeOpacity={0.8}
              >
                <ThemedCard
                  style={[
                    styles.card,
                    isSelected && {
                      borderColor: theme.iconColorFocused,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Ionicons
                    name="people-outline"
                    size={22}
                    color={
                      isSelected ? theme.iconColorFocused : theme.iconColor
                    }
                    style={styles.icon}
                  />
                  <ThemedView style={styles.textContainer}>
                    <ThemedText title>{item.team.name}</ThemedText>
                    <ThemedText style={styles.subText}>
                      {t[language]?.prof_role || t.en.prof_role}:{" "}
                      {item.role?.name || t[language].athlete}
                    </ThemedText>
                  </ThemedView>
                </ThemedCard>
              </TouchableOpacity>
            );
          })
        ) : (
          <ThemedText style={styles.emptyText}>
            {t[language]?.prof_no_teams || t.en.prof_no_teams}
          </ThemedText>
        )}

        {/* DEVICES SECTION */}
        <ThemedText title style={[styles.sectionTitle, { marginTop: 25 }]}>
          {t[language]?.prof_my_devices || t.en.prof_my_devices}
        </ThemedText>

        {user?.devices?.length ? (
          user.devices.map((item) => (
            <ThemedCard key={item.id.toString()} style={styles.card}>
              <Ionicons
                name="hardware-chip-outline"
                size={22}
                color={theme.iconColor}
                style={styles.icon}
              />
              <ThemedView style={styles.textContainer}>
                <ThemedText title>{item.device_type.name}</ThemedText>
                <ThemedText style={styles.subText}>
                  {t[language]?.prof_serial || t.en.prof_serial}:{" "}
                  {item.serial_number}
                </ThemedText>
                <ThemedText style={styles.subText}>
                  {t[language]?.prof_mac || t.en.prof_mac}: {item.mac_address}
                </ThemedText>
              </ThemedView>
            </ThemedCard>
          ))
        ) : (
          <ThemedText style={styles.emptyText}>
            {t[language]?.prof_no_devices || t.en.prof_no_devices}
          </ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    padding: 15,
    borderRadius: 10,
  },
  icon: {
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    padding: 6,
    borderRadius: 5,
    paddingHorizontal: 10,
  },
  subText: {
    fontSize: 13,
    opacity: 0.8,
  },
  emptyText: {
    textAlign: "center",
    marginVertical: 10,
    fontSize: 14,
    opacity: 0.7,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
});
