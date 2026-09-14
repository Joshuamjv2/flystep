import { useState, useEffect, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { get_device_activities } from "../api/activities";
import { activity_attributes } from "../api/attributes";

const cacheKey = (deviceTypeId, language) =>
  `activities_${deviceTypeId}_${language}`;

// Updated to include language in the cache key
export const attributesCacheKey = (subActivityId, language) =>
  `activity_attributes_${subActivityId}_${language}`;

export function useActivities(deviceTypeId, language = "en") {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!deviceTypeId) {
      setActivities([]);
      setIsLoading(false);
      return;
    }

    const key = cacheKey(deviceTypeId, language);

    const load = async () => {
      setIsLoading(true);
      setError(null);

      // ── Step 1: serve from cache immediately ──────────────────────────
      try {
        const cached = await AsyncStorage.getItem(key);
        if (cached && isMounted.current) {
          setActivities(
            JSON.parse(cached).filter(
              (item) => item.activity.id !== "08166353-ead8-471a-8d4b-9192d7b2025b",
            ),
          );
          setIsLoading(false);
        }
      } catch (e) {
        console.warn("[useActivities] Cache read failed:", e?.message);
      }

      // ── Step 2: fetch fresh from API in background ────────────────────
      try {
        const fresh = await get_device_activities(deviceTypeId, language);
        if (!isMounted.current) return;

        setActivities(
          fresh.filter(
            // exclude frequeza for now
            (item) => item.activity.id !== "08166353-ead8-471a-8d4b-9192d7b2025b",
          ),
        );
        setIsLoading(false);
        await AsyncStorage.setItem(key, JSON.stringify(fresh));
      } catch (e) {
        console.warn("[useActivities] API fetch failed:", e?.message);
        if (isMounted.current) {
          setError(e);
          setIsLoading(false);
        }
      }
    };

    load();
  }, [deviceTypeId, language]);

  // ── Prefetch all sub-activity attributes when an activity is selected ──
  // Now includes language in the cache key
  const selectActivity = useCallback(
    async (activity) => {
      const subActivities = activity?.activity?.sub_activities ?? [];

      if (subActivities.length === 0) return;

      console.log(
        `[useActivities] Prefetching attributes for ${subActivities.length} sub-activities in ${language}`,
      );

      await Promise.allSettled(
        subActivities.map(async (sub) => {
          if (!sub?.id) return;

          // Cache key now includes language
          const cKey = attributesCacheKey(sub.id, language);

          // Skip if already cached for this language
          try {
            const existing = await AsyncStorage.getItem(cKey);
            if (existing) {
              console.log(
                `[useActivities] Attributes already cached for sub: ${sub.id} in ${language}`,
              );
              return;
            }
          } catch (_) {}

          // Fetch and cache with language-specific key
          try {
            const attrs = await activity_attributes(sub.id);
            await AsyncStorage.setItem(cKey, JSON.stringify(attrs));
            console.log(
              `[useActivities] Cached attributes for sub: ${sub.id} in ${language}`,
            );
          } catch (e) {
            console.warn(
              `[useActivities] Failed to prefetch attributes for sub ${sub.id}:`,
              e?.message,
            );
          }
        }),
      );
    },
    [language],
  ); // Add language as dependency

  const refresh = async () => {
    if (!deviceTypeId) return;
    setError(null);
    try {
      const fresh = await get_device_activities(deviceTypeId, language);
      if (!isMounted.current) return;
      setActivities(fresh);
      await AsyncStorage.setItem(
        cacheKey(deviceTypeId, language),
        JSON.stringify(fresh),
      );
    } catch (e) {
      console.warn("[useActivities] Refresh failed:", e?.message);
      if (isMounted.current) setError(e);
    }
  };

  return { activities, isLoading, error, refresh, selectActivity };
}
