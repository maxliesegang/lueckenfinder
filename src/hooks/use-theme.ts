import { useCallback, useEffect, useState } from "react";
import {
  applyThemePreference,
  getThemePreference,
  saveThemePreference,
  subscribeToSystemThemeChange,
  type ThemePreference,
} from "../theme";

export interface ThemeSettings {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
}

export function useTheme(): ThemeSettings {
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>(getThemePreference);

  const setThemePreference = useCallback(
    (preference: ThemePreference) => setThemePreferenceState(preference),
    [],
  );

  useEffect(() => {
    saveThemePreference(themePreference);
    applyThemePreference(themePreference);
    if (themePreference !== "system") return undefined;
    return subscribeToSystemThemeChange(() => {
      applyThemePreference("system");
    });
  }, [themePreference]);

  return { themePreference, setThemePreference };
}
