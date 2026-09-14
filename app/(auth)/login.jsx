import {
  StyleSheet,
  TouchableWithoutFeedback,
  Text,
  View,
  Image,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  useColorScheme,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import ThemedView from "../../components/ThemedView";
import ThemedText from "../../components/ThemedText";
import ThemedButton from "../../components/ThemedButton";
import ThemedTextInput from "../../components/ThemedTextInput";
import Spacer from "../../components/Spacer";
import ThemedLoader from "../../components/ThemedLoader";
import { useAuth } from "../../hooks/useAuth";
import { Colors } from "../../constants/Colors";
import Logo from "../../assets/seere/previo.png";
import { t } from "../../constants/translations";

const SECURE_KEYS = {
  email: "remember_email",
  password: "remember_password",
};

const Login = () => {
  const { height } = useWindowDimensions();
  const isShortScreen = height < 700;
  const scrollViewRef = useRef(null);

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const { handleLogin, language } = useAuth();

  useEffect(() => {
    const load = async () => {
      try {
        const savedEmail = await SecureStore.getItemAsync(SECURE_KEYS.email);
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch (_) {}
    };
    load();

    // Keyboard listeners
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardVisible(true),
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardVisible(false),
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const handleSubmit = async () => {
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    try {
      await handleLogin(email, password, rememberMe);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ThemedLoader style={{ flex: 1 }} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={!keyboardVisible}
        >
          <ThemedView
            style={[
              styles.container,
              isShortScreen && styles.containerShortScreen,
            ]}
          >
            {/* Header with Logo and Title */}
            <View style={styles.headerContainer}>
              <Image
                source={Logo}
                style={[styles.logo, isShortScreen && styles.logoShortScreen]}
              />
              <ThemedText style={[styles.title, { color: theme.title }]}>
                {t[language]?.welcome_back || t.en.welcome_back}
              </ThemedText>
            </View>

            <ThemedText style={[styles.subtitle, { color: theme.subtleText }]}>
              {t[language]?.login_subtitle || t.en.login_subtitle}
            </ThemedText>

            <Spacer height={32} />

            {/* Email */}
            <ThemedTextInput
              placeholder={t[language]?.email_ph || t.en.email_ph}
              placeholderTextColor={theme.subtleText}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              style={styles.input}
              onChangeText={setEmail}
            />

            <Spacer height={10} />

            {/* Password + eye toggle */}
            <View style={styles.passwordWrapper}>
              <ThemedTextInput
                key={showPassword ? "visible" : "hidden"}
                placeholder={t[language]?.password_ph || t.en.password_ph}
                placeholderTextColor={theme.subtleText}
                secureTextEntry={!showPassword}
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
              />

              <Pressable
                hitSlop={10}
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color={theme.iconColor}
                />
              </Pressable>
            </View>

            <Spacer height={14} />

            {/* Remember me */}
            <Pressable
              onPress={() => setRememberMe((v) => !v)}
              style={styles.rememberRow}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: theme.border,
                    backgroundColor: "transparent",
                  },
                  rememberMe && {
                    backgroundColor: Colors.primary,
                    borderColor: Colors.primary,
                  },
                ]}
              >
                {rememberMe && (
                  <Ionicons name="checkmark" size={13} color="#fff" />
                )}
              </View>

              <Text style={[styles.rememberLabel, { color: theme.text }]}>
                {t[language]?.remember_me || t.en.remember_me}
              </Text>
            </Pressable>

            <Spacer height={16} />

            {/* Login button */}
            <ThemedButton onPress={handleSubmit} style={styles.button}>
              <Text style={styles.buttonText}>
                {t[language]?.login_btn || t.en.login_btn}
              </Text>
            </ThemedButton>

            <Spacer height={20} />

            {/* Error */}
            {error && (
              <Text
                style={[
                  styles.error,
                  {
                    backgroundColor:
                      colorScheme === "dark"
                        ? "rgba(204, 71, 90, 0.15)"
                        : "#f5c1c8",
                  },
                ]}
              >
                {error}
              </Text>
            )}
          </ThemedView>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default Login;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },

  containerShortScreen: {
    justifyContent: "flex-start",
    paddingTop: 30,
    paddingBottom: 30,
  },

  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 8,
  },

  logo: {
    width: 40,
    height: 40,
    resizeMode: "contain",
  },

  logoShortScreen: {
    width: 35,
    height: 35,
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
  },

  subtitle: {
    fontSize: 14,
    textAlign: "center",
  },

  input: {
    width: "90%",
  },

  passwordWrapper: {
    width: "90%",
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    width: "100%",
    paddingRight: 44,
  },
  eyeButton: {
    position: "absolute",
    right: 14,
    padding: 4,
  },

  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginLeft: "5%",
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  rememberLabel: {
    fontSize: 14,
    fontWeight: "500",
  },

  button: {
    backgroundColor: Colors.primary,
    width: "90%",
    marginTop: 5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
  },

  error: {
    color: Colors.warning,
    padding: 15,
    borderColor: Colors.warning,
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 10,
    width: "90%",
    textAlign: "center",
  },
});
