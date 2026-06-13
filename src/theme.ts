export const THEME_PREFERENCES = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = Exclude<ThemePreference, "system">;

const STORAGE_KEY = "lueckenfinder:theme";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";
const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

interface ThemeRoot {
  dataset: { kernTheme?: string };
  style: { colorScheme: string };
}

export function getThemePreference(): ThemePreference {
  if (typeof localStorage === "undefined") return DEFAULT_THEME_PREFERENCE;
  try {
    return parseThemePreference(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (preference === "system") {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Theme persistence is optional.
  }
}

export function resolveThemePreference(
  preference: ThemePreference,
  matchesDarkScheme = prefersDarkScheme(),
): ResolvedTheme {
  if (preference !== "system") return preference;
  return matchesDarkScheme ? "dark" : "light";
}

export function applyThemePreference(
  preference: ThemePreference,
  root = getThemeRoot(),
): ResolvedTheme {
  const resolvedTheme = resolveThemePreference(preference);
  if (root) {
    root.dataset.kernTheme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }
  return resolvedTheme;
}

export function parseThemePreference(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : DEFAULT_THEME_PREFERENCE;
}

export function subscribeToSystemThemeChange(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function prefersDarkScheme(): boolean {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia(DARK_MEDIA_QUERY).matches
    : false;
}

function getThemeRoot(): ThemeRoot | undefined {
  return typeof document === "undefined" ? undefined : document.documentElement;
}

function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}
