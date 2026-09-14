import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const apiUrl = process.env.EXPO_PUBLIC_API_URL;

const client = axios.create({
  baseURL: apiUrl,
  headers: { Accept: "application/json" },
});

const refreshClient = axios.create({
  baseURL: apiUrl,
  headers: { Accept: "application/json" },
});

// ------------------------------------------
// SESSION EXPIRY CALLBACK
// ------------------------------------------
let _onSessionExpired = null;

export const setSessionExpiredHandler = (handler) => {
  _onSessionExpired = handler;
};

// ------------------------------------------
// REFRESH QUEUE
// ------------------------------------------
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token);
  });
  failedQueue = [];
};

// ------------------------------------------
// REQUEST: attach access token
// Skip attaching if it's the refresh endpoint itself
// ------------------------------------------
client.interceptors.request.use(async (config) => {
  if (config.url === "/auth/refresh_token") return config;

  const tokenStr = await AsyncStorage.getItem("tokens");
  if (tokenStr) {
    const { access_token } = JSON.parse(tokenStr);
    if (access_token) {
      config.headers.Authorization = `Bearer ${access_token}`;
    }
  }
  return config;
});

// ------------------------------------------
// RESPONSE: refresh on 401
// ------------------------------------------
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error?.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          original.headers.Authorization = `Bearer ${newToken}`;
          return client(original);
        })
        .catch((err) => Promise.reject(err));
    }

    isRefreshing = true;

    try {
      const tokensStr = await AsyncStorage.getItem("tokens");
      if (!tokensStr) throw new Error("Invalid email/password");

      const { refresh_token } = JSON.parse(tokensStr);
      if (!refresh_token) throw new Error("Missing refresh_token");

      // ✅ GET with refresh token as Bearer — matches the web implementation
      const { data: newTokens } = await refreshClient.get(
        "/auth/refresh_token",
        {
          headers: { Authorization: `Bearer ${refresh_token}` },
        },
      );

      if (!newTokens?.access_token) {
        throw new Error("Refresh response missing access_token");
      }

      const save = {
        access_token: newTokens.access_token,
        refresh_token: refresh_token, // refresh token stays the same
      };

      await AsyncStorage.setItem("tokens", JSON.stringify(save));

      processQueue(null, newTokens.access_token);
      isRefreshing = false;

      original.headers.Authorization = `Bearer ${newTokens.access_token}`;
      return client(original);
    } catch (err) {
      processQueue(err, null);
      isRefreshing = false;
      await AsyncStorage.removeItem("tokens");
      _onSessionExpired?.();
      return Promise.reject(err);
    }
  },
);

// ------------------------------------------
// Public request wrapper
// ------------------------------------------
const request = async (options) => {
  try {
    const res = await client(options);
    return res.data;
  } catch (error) {
    return Promise.reject({
      message:
        error?.response?.data?.message ||
        error?.message ||
        "Request failed unexpectedly",
      code: error.code,
      response: error.response,
    });
  }
};

export default request;
