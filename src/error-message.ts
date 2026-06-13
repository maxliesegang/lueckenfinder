import { t, translateMessage } from "./i18n";

/** Maps an error to a localized, user-facing status message. */
export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/failed to fetch|networkerror|network request failed/i.test(message)) {
    return t("status.networkError");
  }
  return translateMessage(message);
}
