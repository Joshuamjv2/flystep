import { createContext, useEffect, useState, useCallback } from "react";
import { login, logout, user_info } from "../api/auth";
import { get_device_types } from "../api/device_types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export const UserContext = createContext();

// ── Storage keys ─────────────────────────────────────────────────────────────
const KEYS = {
  tokens: "tokens",
  user: "user",
  deviceTypes: "device_types",
  teams: "teams",
  selectedTeam: "selected_team",
  language: "language",
  emailConfig: "email_config",

  // NEW: settings email address storage
  emailAddress: "@settings_email_address",
};

// Stored in SecureStore — encrypted on device, never in AsyncStorage
const SECURE_KEYS = {
  email: "remember_email",
  password: "remember_password",
};

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [deviceTypesChecked, setDeviceTypesChecked] = useState(false);
  const [language, setLanguage] = useState("en");
  const [emailUpdates, setEmailUpdates] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeamState] = useState(null);

  // ── Team helpers ──────────────────────────────────────────────────────────
  const hydrateTeams = async (userData, storedSelectedTeam = null) => {
    const raw = userData?.teams ?? [];
    const flat = raw.map((t) => ({
      id: t.team.id,
      name: t.team.name,
      role: t.role,
    }));

    setTeams(flat);
    await AsyncStorage.setItem(KEYS.teams, JSON.stringify(flat));

    if (flat.length > 0) {
      const restoredId = storedSelectedTeam?.id;
      const stillValid = restoredId && flat.some((t) => t.id === restoredId);
      const toSelect = stillValid ? storedSelectedTeam : flat[0];
      setSelectedTeamState(toSelect);
      await AsyncStorage.setItem(KEYS.selectedTeam, JSON.stringify(toSelect));
    }
  };

  const handleSelectTeam = async (team) => {
    setSelectedTeamState(team);
    await AsyncStorage.setItem(KEYS.selectedTeam, JSON.stringify(team));
  };

  // ── Core login logic — shared by handleLogin and auto-login ───────────────
  const performLogin = async (email, password) => {
    const res = await login({ email, password });

    const tokens = {
      access_token: res.access_token,
      refresh_token: res.refresh_token,
      uid: res.user.id,
    };
    await AsyncStorage.setItem(KEYS.tokens, JSON.stringify(tokens));

    const userData = await user_info({refresh: true});
    console.log("\n\n", userData, "\n\n")
    setUser(userData);
    await AsyncStorage.setItem(KEYS.user, JSON.stringify(userData));
    await hydrateTeams(userData, null);

    try {
      const types = await get_device_types();
      setDeviceTypes(types);
      await AsyncStorage.setItem(KEYS.deviceTypes, JSON.stringify(types));
    } catch (err) {
      console.log("[Auth] Failed fetching device types:", err);
    } finally {
      setDeviceTypesChecked(true);
    }
  };

  // Refresh user
  const refreshUser = useCallback(async () => {
    try {
      const freshUser = await user_info({ refresh: true });
      setUser(freshUser);
      await AsyncStorage.setItem(KEYS.user, JSON.stringify(freshUser));
      await hydrateTeams(freshUser, selectedTeam);
    } catch (error) {
      console.log("[Auth] refreshUser failed:", error);
    }
  }, [selectedTeam]);
  // ── Public login — called from UI ─────────────────────────────────────────
  async function handleLogin(email, password, rememberMe = false) {
    await performLogin(email, password);

    if (rememberMe) {
      // Store credentials encrypted — SecureStore handles keychain/keystore
      await SecureStore.setItemAsync(SECURE_KEYS.email, email);
      await SecureStore.setItemAsync(SECURE_KEYS.password, password);
    } else {
      // User unchecked remember me — clear any previously stored credentials
      await SecureStore.deleteItemAsync(SECURE_KEYS.email).catch(() => {});
      await SecureStore.deleteItemAsync(SECURE_KEYS.password).catch(() => {});
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  async function handleLogout() {
    try {
      await logout();
    } catch (e) {
      console.log("[Auth] Logout request failed:", e?.message);
    } finally {
      // IMPORTANT:
      // Do NOT wipe all AsyncStorage, because it removes user settings (language/email config).
      // Only remove session/auth-related keys.
      await AsyncStorage.multiRemove([
        KEYS.tokens,
        KEYS.user,
        KEYS.deviceTypes,
        KEYS.teams,
        KEYS.selectedTeam,
      ]).catch(() => {});

      // SecureStore: DO NOT delete remember_me credentials unless you want logout to also forget them.
      // Keep remember me behavior as-is.
      await Promise.allSettled([
        // Keep these if you want remember-me login after logout.
        // SecureStore.deleteItemAsync(SECURE_KEYS.email),
        // SecureStore.deleteItemAsync(SECURE_KEYS.password),

        // If you ever store tokens here later, these will also be removed safely
        SecureStore.deleteItemAsync("tokens"),
        SecureStore.deleteItemAsync("access_token"),
        SecureStore.deleteItemAsync("refresh_token"),
        SecureStore.deleteItemAsync("user"),
      ]);

      setUser(null);
      setDeviceTypes([]);
      setTeams([]);
      setSelectedTeamState(null);
    }
  }

  // ── Language / emails ─────────────────────────────────────────────────────
  async function handleLanguage(lang) {
    setLanguage(lang);
    await AsyncStorage.setItem(KEYS.language, lang);
  }

  async function handleEmails(checked) {
    setEmailUpdates(checked);
    await AsyncStorage.setItem(KEYS.emailConfig, checked.toString());
  }

  // ── Initialize — storage first, then API ──────────────────────────────────
  async function initialize() {
    try {
      const [
        storedUser,
        storedLanguage,
        storedEmail,
        storedDevices,
        storedTokens,
        storedTeams,
        storedSelectedTeam,
      ] = await Promise.all([
        AsyncStorage.getItem(KEYS.user),
        AsyncStorage.getItem(KEYS.language),
        AsyncStorage.getItem(KEYS.emailConfig),
        AsyncStorage.getItem(KEYS.deviceTypes),
        AsyncStorage.getItem(KEYS.tokens),
        AsyncStorage.getItem(KEYS.teams),
        AsyncStorage.getItem(KEYS.selectedTeam),
      ]);

      // Hydrate from cache immediately for instant UI
      if (storedLanguage) setLanguage(storedLanguage);
      if (storedDevices) setDeviceTypes(JSON.parse(storedDevices));
      if (storedTeams) setTeams(JSON.parse(storedTeams));
      if (storedSelectedTeam)
        setSelectedTeamState(JSON.parse(storedSelectedTeam));
      if (storedUser) setUser(JSON.parse(storedUser));
      setEmailUpdates(storedEmail === "true");

      if (!storedTokens) {
        // No session — check if remember me credentials exist and auto-login
        const savedEmail = await SecureStore.getItemAsync(
          SECURE_KEYS.email,
        ).catch(() => null);
        const savedPassword = await SecureStore.getItemAsync(
          SECURE_KEYS.password,
        ).catch(() => null);

        if (savedEmail && savedPassword) {
          console.log("[Auth] Remember me — auto-logging in");
          try {
            await performLogin(savedEmail, savedPassword);
          } catch (err) {
            console.log("[Auth] Auto-login failed:", err?.message);
            // Clear bad credentials so we don't retry forever
            await SecureStore.deleteItemAsync(SECURE_KEYS.email).catch(
              () => {},
            );
            await SecureStore.deleteItemAsync(SECURE_KEYS.password).catch(
              () => {},
            );
          }
        }
        return;
      }

      // Tokens exist — refresh user info in background
      let freshUser;
      try {
        freshUser = await user_info();
        setUser(freshUser);
        await AsyncStorage.setItem(KEYS.user, JSON.stringify(freshUser));
      } catch (error) {
        console.log("[Auth] user_info failed — tokens likely expired:", error);
        await AsyncStorage.multiRemove([
          KEYS.tokens,
          KEYS.user,
          KEYS.teams,
          KEYS.selectedTeam,
        ]);

        setUser(null);
        setTeams([]);
        setSelectedTeamState(null);

        // Tokens expired — try auto-login with stored credentials if present
        const savedEmail = await SecureStore.getItemAsync(
          SECURE_KEYS.email,
        ).catch(() => null);
        const savedPassword = await SecureStore.getItemAsync(
          SECURE_KEYS.password,
        ).catch(() => null);

        if (savedEmail && savedPassword) {
          console.log("[Auth] Tokens expired — attempting auto-login");
          try {
            await performLogin(savedEmail, savedPassword);
          } catch (err) {
            console.log("[Auth] Auto-login after expiry failed:", err?.message);
            await SecureStore.deleteItemAsync(SECURE_KEYS.email).catch(
              () => {},
            );
            await SecureStore.deleteItemAsync(SECURE_KEYS.password).catch(
              () => {},
            );
          }
        }
        return;
      }

      const parsedSelectedTeam = storedSelectedTeam
        ? JSON.parse(storedSelectedTeam)
        : null;
      await hydrateTeams(freshUser, parsedSelectedTeam);

      try {
        const types = await get_device_types();
        setDeviceTypes(types);
        await AsyncStorage.setItem(KEYS.deviceTypes, JSON.stringify(types));
      } catch (err) {
        console.log("[Auth] Failed fetching device types:", err);
      } finally {
        setDeviceTypesChecked(true);
      }
    } finally {
      setAuthChecked(true);
    }
  }

  useEffect(() => {
    initialize();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <UserContext.Provider
      value={{
        user,
        deviceTypes,
        deviceTypesChecked,
        language,
        emailUpdates,
        authChecked,
        teams,
        selectedTeam,
        handleLogin,
        handleLogout,
        handleLanguage,
        handleEmails,
        handleSelectTeam,
        refreshUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
