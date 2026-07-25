import type { TranslationKey } from "./i18n";
import type { Dataset } from "./types";

/**
 * How a dataset announces where it came from. Presets are the unmarked
 * default — everything the user added or imported says so, in the list and on
 * the selected entry alike.
 */
const BADGE_KEYS: Partial<Record<Dataset["source"], TranslationKey>> = {
  custom: "dataset.customBadge",
  imported: "dataset.importedBadge",
};

export function datasetBadgeKey(
  source: Dataset["source"] | undefined,
): TranslationKey | undefined {
  return source === undefined ? undefined : BADGE_KEYS[source];
}
