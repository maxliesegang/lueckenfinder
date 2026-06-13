import {
  KernDialog,
  KernDialogBody,
  KernDialogFooter,
  KernDialogFooterButton,
  KernDialogHeader,
  KernDialogModal,
  KernDialogTrigger,
  KernDivider,
  KernHeading,
  KernInput,
  KernSelect,
  KernText,
} from "@kern-ux-annex/kern-react-kit";
import { MAX_MATCH_RADIUS_M, MIN_MATCH_RADIUS_M } from "../dataset-constraints";
import { useI18n } from "../hooks/use-i18n";
import type { Language } from "../i18n";
import { parseThemePreference, type ThemePreference } from "../theme";

interface AppMenuDialogProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (themePreference: ThemePreference) => void;
  matchRadius: number;
  onMatchRadiusChange: (matchRadius: number) => void;
}

const DIALOG_ID = "app-menu-dialog";

export function AppMenuDialog({
  language,
  onLanguageChange,
  themePreference,
  onThemePreferenceChange,
  matchRadius,
  onMatchRadiusChange,
}: AppMenuDialogProps) {
  const { t } = useI18n();

  return (
    <KernDialog id={DIALOG_ID}>
      <KernDialogTrigger
        className="settings-trigger"
        variant="tertiary"
        icon="more-vert"
        label=""
        alt={t("menu.openAria")}
      />
      <KernDialogModal aria-labelledby={`${DIALOG_ID}-title`}>
        <KernDialogHeader dialogTitle={t("menu.title")} showCloseButton />
        <KernDialogBody className="app-menu-body">
          <KernHeading level={3} size="small">
            {t("settings.title")}
          </KernHeading>
          <KernSelect
            id="settings-language"
            label={t("language.label")}
            required
            value={language}
            onChange={(event) => onLanguageChange(event.target.value as Language)}
          >
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </KernSelect>
          <KernSelect
            id="settings-theme"
            label={t("theme.label")}
            required
            value={themePreference}
            onChange={(event) =>
              onThemePreferenceChange(parseThemePreference(event.target.value))
            }
          >
            <option value="system">{t("theme.system")}</option>
            <option value="light">{t("theme.light")}</option>
            <option value="dark">{t("theme.dark")}</option>
          </KernSelect>
          <KernInput
            id="settings-match-radius"
            type="number"
            label={t("settings.matchRadius")}
            hint={t("settings.matchRadiusHint")}
            required
            min={MIN_MATCH_RADIUS_M}
            max={MAX_MATCH_RADIUS_M}
            value={Number.isNaN(matchRadius) ? "" : matchRadius}
            onChange={(event) => onMatchRadiusChange(event.target.valueAsNumber)}
          />
          <KernDivider spacing="small" />

          <KernHeading level={3} size="small">
            {t("help.title")}
          </KernHeading>
          <KernText>{t("app.tagline")}</KernText>

          <KernHeading level={4} size="small">
            {t("about.disclaimerHeading")}
          </KernHeading>
          <KernText>{t("about.disclaimer")}</KernText>

          <KernText size="small" muted>
            {t("about.attribution")}
          </KernText>
        </KernDialogBody>
        <KernDialogFooter>
          <KernDialogFooterButton
            variant="primary"
            onClick={(_event, { closeDialog }) => closeDialog()}
          >
            {t("actions.done")}
          </KernDialogFooterButton>
        </KernDialogFooter>
      </KernDialogModal>
    </KernDialog>
  );
}
