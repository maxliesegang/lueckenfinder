import type { Language } from "../../i18n";
import type { ThemePreference } from "../../theme";
import { AppMenuDialog } from "../app-menu-dialog";
import "./toolbar.css";

interface ToolbarProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (themePreference: ThemePreference) => void;
  matchRadius: number;
  onMatchRadiusChange: (matchRadius: number) => void;
}

/**
 * Floating top-right toolbar. Holds app-level affordances in one modal menu so
 * the control panel can stay focused on the dataset workflow.
 */
export function Toolbar({
  language,
  onLanguageChange,
  themePreference,
  onThemePreferenceChange,
  matchRadius,
  onMatchRadiusChange,
}: ToolbarProps) {
  return (
    <div className="map-toolbar">
      <AppMenuDialog
        language={language}
        onLanguageChange={onLanguageChange}
        themePreference={themePreference}
        onThemePreferenceChange={onThemePreferenceChange}
        matchRadius={matchRadius}
        onMatchRadiusChange={onMatchRadiusChange}
      />
    </div>
  );
}
