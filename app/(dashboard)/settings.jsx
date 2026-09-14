import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
  ScrollView,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import { Colors } from "../../constants/Colors";
import ThemedView from "../../components/ThemedView";
import ThemedText from "../../components/ThemedText";
import ThemedCard from "../../components/ThemedCard";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { t } from "../../constants/translations";

const LANGUAGES = [
  { code: "en", label: "English", flag: "flag-outline" },
  { code: "de", label: "Deutsch", flag: "flag-outline" },
  { code: "fr", label: "Français", flag: "flag-outline" },
  { code: "es", label: "Español", flag: "flag-outline" },
  { code: "it", label: "Italiano", flag: "flag-outline" },
];

const STORAGE_KEYS = {
  emailUpdates: "@settings_email_updates",
  emailAddress: "@settings_email_address",
};

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? "light";
  const theme = Colors[scheme];

  const router = useRouter();

  const {
    handleLogout,
    language: contextLanguage,
    emailUpdates: contextEmailUpdates,
    handleLanguage,
    handleEmails,
    teams,
    selectedTeam,
    handleSelectTeam,
    user,
  } = useAuth();

  const [language, setLanguage] = useState(contextLanguage || "en");
  const [emailUpdates, setEmailUpdates] = useState(contextEmailUpdates ?? true);

  // NEW: email form state
  const defaultUserEmail = user?.email ?? "";
  const [emailAddress, setEmailAddress] = useState(defaultUserEmail);
  const [savedEmailAddress, setSavedEmailAddress] = useState(defaultUserEmail);
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // Load saved settings from AsyncStorage on mount
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedToggle = await AsyncStorage.getItem(
          STORAGE_KEYS.emailUpdates,
        );
        const savedEmail = await AsyncStorage.getItem(
          STORAGE_KEYS.emailAddress,
        );

        if (savedToggle != null) {
          setEmailUpdates(savedToggle === "true");
        }

        if (savedEmail != null) {
          setEmailAddress(savedEmail);
          setSavedEmailAddress(savedEmail);
        } else {
          // fallback to user email if nothing saved
          setEmailAddress(defaultUserEmail);
          setSavedEmailAddress(defaultUserEmail);
        }
      } catch (err) {
        console.warn("[Settings] Failed to load email settings:", err);
      }
    };

    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Persist language
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    handleLanguage(language);
  }, [language]);

  // ─────────────────────────────────────────────────────────────
  // Persist email toggle to auth context + AsyncStorage
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    handleEmails(emailUpdates);

    const persistToggle = async () => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.emailUpdates,
          String(emailUpdates),
        );
      } catch (err) {
        console.warn("[Settings] Failed to persist email toggle:", err);
      }
    };

    persistToggle();

    // if toggle turned off, exit edit mode
    if (!emailUpdates) {
      setIsEditingEmail(false);
      setEmailAddress(savedEmailAddress);
    }
  }, [emailUpdates]);

  // Keep default email updated if user changes (login/logout)
  useEffect(() => {
    if (!savedEmailAddress && defaultUserEmail) {
      setEmailAddress(defaultUserEmail);
      setSavedEmailAddress(defaultUserEmail);
    }
  }, [defaultUserEmail]);

  const isEmailValid = (email) => {
    if (!email) return false;
    const trimmed = email.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  };

  const canSave =
    emailUpdates &&
    isEditingEmail &&
    emailAddress.trim() !== savedEmailAddress.trim() &&
    isEmailValid(emailAddress);

  const handleSaveEmail = async () => {
    const trimmed = emailAddress.trim();

    if (!isEmailValid(trimmed)) return;

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.emailAddress, trimmed);
      setSavedEmailAddress(trimmed);
      setEmailAddress(trimmed);
      setIsEditingEmail(false);
    } catch (err) {
      console.warn("[Settings] Failed to save email:", err);
    }
  };

  const handleCancelEdit = () => {
    setEmailAddress(savedEmailAddress);
    setIsEditingEmail(false);
  };

  return (
    <ThemedView safeTop style={styles.container}>
      {/* Scrollable content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText title style={styles.title}>
          {t[language]?.sett_title || t.en.sett_title}
        </ThemedText>

        {/* TEAM SELECTOR */}
        {teams?.length > 0 && (
          <ThemedCard style={styles.section}>
            <ThemedText title style={styles.sectionTitle}>
              {t[language]?.sett_team || t.en.sett_team}
            </ThemedText>

            {teams.map((team) => (
              <TouchableOpacity
                key={team.id}
                onPress={() => handleSelectTeam(team)}
                style={[
                  styles.languageRow,
                  {
                    backgroundColor:
                      selectedTeam?.id === team.id
                        ? theme.selectedBackground
                        : "transparent",
                  },
                ]}
              >
                <Ionicons
                  name="people-outline"
                  size={20}
                  color={theme.iconColor}
                  style={styles.flagIcon}
                />
                <ThemedText style={styles.languageText}>{team.name}</ThemedText>

                {selectedTeam?.id === team.id && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={theme.iconColorFocused}
                  />
                )}
              </TouchableOpacity>
            ))}
          </ThemedCard>
        )}

        {/* LANGUAGE SELECTOR */}
        <ThemedCard style={styles.section}>
          <ThemedText title style={styles.sectionTitle}>
            {t[language]?.sett_language || t.en.sett_language}
          </ThemedText>

          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              onPress={() => setLanguage(lang.code)}
              style={[
                styles.languageRow,
                {
                  backgroundColor:
                    language === lang.code
                      ? theme.selectedBackground
                      : "transparent",
                },
              ]}
            >
              <Ionicons
                name={lang.flag}
                size={20}
                color={theme.iconColor}
                style={styles.flagIcon}
              />
              <ThemedText style={styles.languageText}>{lang.label}</ThemedText>

              {language === lang.code && (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={theme.iconColorFocused}
                />
              )}
            </TouchableOpacity>
          ))}
        </ThemedCard>

        {/* EMAIL UPDATES */}
        <ThemedCard style={styles.section}>
          <View style={styles.row}>
            <ThemedText title>
              {t[language]?.sett_email_updates || t.en.sett_email_updates}
            </ThemedText>
            <Switch
              value={emailUpdates}
              onValueChange={setEmailUpdates}
              thumbColor={emailUpdates ? theme.iconColorFocused : "#ccc"}
            />
          </View>

          <ThemedText style={styles.subText}>
            {t[language]?.sett_email_sub || t.en.sett_email_sub}
          </ThemedText>

          {/* Email Form */}
          <View
            style={[
              styles.emailBox,
              {
                borderColor: theme.border,
                backgroundColor: emailUpdates
                  ? theme.uiBackground
                  : theme.accentSurface,
                opacity: emailUpdates ? 1 : 0.5,
              },
            ]}
          >
            <ThemedText
              style={[styles.emailLabel, { color: theme.subtleText }]}
            >
              {t[language]?.sett_email_label || t.en.sett_email_label}
            </ThemedText>

            <TextInput
              value={emailAddress}
              onChangeText={setEmailAddress}
              editable={emailUpdates && isEditingEmail}
              placeholder={t[language]?.sett_email_ph || t.en.sett_email_ph}
              placeholderTextColor={theme.subtleText}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[
                styles.emailInput,
                {
                  color: theme.title,
                  borderColor: theme.border,
                  backgroundColor: emailUpdates
                    ? theme.background
                    : theme.accentSurface,
                },
              ]}
            />

            {!emailUpdates ? (
              <View style={styles.emailActions}>
                <ThemedText
                  style={[styles.disabledText, { color: theme.subtleText }]}
                >
                  {t[language]?.sett_email_disabled || t.en.sett_email_disabled}
                </ThemedText>
              </View>
            ) : (
              <View style={styles.emailActions}>
                {!isEditingEmail ? (
                  <TouchableOpacity
                    onPress={() => setIsEditingEmail(true)}
                    style={[
                      styles.actionBtn,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.background,
                      },
                    ]}
                  >
                    <Ionicons
                      name="create-outline"
                      size={16}
                      color={theme.iconColor}
                      style={{ marginRight: 6 }}
                    />
                    <ThemedText style={{ fontWeight: "700" }}>
                      {t[language]?.sett_edit || t.en.sett_edit}
                    </ThemedText>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={handleCancelEdit}
                      style={[
                        styles.actionBtn,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.background,
                        },
                      ]}
                    >
                      <Ionicons
                        name="close-outline"
                        size={16}
                        color={theme.iconColor}
                        style={{ marginRight: 6 }}
                      />
                      <ThemedText style={{ fontWeight: "700" }}>
                        {t[language]?.sett_cancel || t.en.sett_cancel}
                      </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleSaveEmail}
                      disabled={!canSave}
                      style={[
                        styles.actionBtn,
                        {
                          borderColor: canSave
                            ? theme.iconColorFocused
                            : theme.border,
                          backgroundColor: canSave
                            ? theme.selectedBackground
                            : theme.background,
                          opacity: canSave ? 1 : 0.5,
                        },
                      ]}
                    >
                      <Ionicons
                        name="save-outline"
                        size={16}
                        color={theme.iconColorFocused}
                        style={{ marginRight: 6 }}
                      />
                      <ThemedText style={{ fontWeight: "700" }}>
                        {t[language]?.sett_save || t.en.sett_save}
                      </ThemedText>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {emailUpdates &&
            isEditingEmail &&
            emailAddress.length > 0 &&
            !isEmailValid(emailAddress) ? (
              <ThemedText
                style={[
                  styles.errorText,
                  { color: theme.warning || "#D9534F" },
                ]}
              >
                {t[language]?.sett_email_invalid || t.en.sett_email_invalid}
              </ThemedText>
            ) : null}
          </View>
        </ThemedCard>
      </ScrollView>

      {/* FIXED LOGOUT BUTTON */}
      <View style={styles.logoutContainer}>
        <TouchableOpacity
          onPress={handleLogout}
          style={[
            styles.logoutButton,
            { backgroundColor: theme.warning || "#D9534F" },
          ]}
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <ThemedText style={{ color: "#fff", fontWeight: "600" }}>
            {t[language]?.sett_logout || t.en.sett_logout}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 10,
  },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  flagIcon: {
    marginRight: 10,
  },
  languageText: {
    flex: 1,
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subText: {
    marginTop: 4,
    opacity: 0.7,
    fontSize: 13,
  },
  emailBox: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  emailLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    opacity: 0.85,
  },
  emailInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "600",
  },
  emailActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  disabledText: {
    fontSize: 12,
    fontWeight: "700",
    opacity: 0.8,
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  logoutContainer: {
    paddingVertical: 10,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
  },
});
