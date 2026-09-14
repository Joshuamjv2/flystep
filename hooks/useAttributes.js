import { useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { activity_attributes } from "../api/attributes";

// Cache key generator that includes language to prevent serving wrong language translations
const attributesCacheKey = (subActivityId, language) =>
  `activity_attributes_${subActivityId}_${language}`;

// Takes the raw API array and resolves each attribute's translation
// for the requested language, falling back to "en" if not found
const resolveAttributes = (raw = [], languageCode = "en") =>
  raw
    .map((item) => {
      const translation =
        item.attribute?.translations?.find(
          (t) => t.language_code === languageCode,
        ) ??
        item.attribute?.translations?.find((t) => t.language_code === "en");

      if (!translation) return null;

      return {
        id: item.attribute.id,
        name: translation.name,
        description: translation.description,
        unit: translation.units,
      };
    })
    .filter(Boolean);

export function useActivityAttributes(subActivityId, language = "en") {
  const [attributes, setAttributes] = useState([]);
  const [isLoading, setIsLoading] = useState(!!subActivityId);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!subActivityId) {
      setAttributes([]);
      setIsLoading(false);
      return;
    }

    // ✅ immediately lock UI until cache/fetch resolves
    setIsLoading(true);
    setAttributes([]);

    const load = async () => {
      // Cache key now includes language
      const cKey = attributesCacheKey(subActivityId, language);

      // ── Step 1: cache first ───────────────────────────────────────────
      try {
        const cached = await AsyncStorage.getItem(cKey);

        if (cached && isMounted.current) {
          console.log(
            `[useActivityAttributes] Using cached attributes for ${subActivityId} in ${language}`,
          );
          setAttributes(resolveAttributes(JSON.parse(cached), language));
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.warn("[useActivityAttributes] Cache read failed:", e?.message);
      }

      // ── Step 2: fallback fetch if cache missed ────────────────────────
      try {
        console.log(
          `[useActivityAttributes] Fetching attributes for ${subActivityId} in ${language}`,
        );
        const fresh = await activity_attributes(subActivityId);
        if (!isMounted.current) return;

        setAttributes(resolveAttributes(fresh, language));
        await AsyncStorage.setItem(cKey, JSON.stringify(fresh));
        console.log(
          `[useActivityAttributes] Cached attributes for ${subActivityId} in ${language}`,
        );
      } catch (e) {
        console.warn("[useActivityAttributes] Fetch failed:", e?.message);
      } finally {
        if (isMounted.current) setIsLoading(false);
      }
    };

    load();
  }, [subActivityId, language]);

  // Look up a single attribute by id — already resolved to correct language
  const getLabel = (attributeId) =>
    attributes.find((a) => a.id === attributeId) ?? null;

  return { attributes, isLoading, getLabel };
}
