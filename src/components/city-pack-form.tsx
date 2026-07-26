import { KernButton } from "@kern-ux-annex/kern-react-kit";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { useI18n } from "../hooks/use-i18n";
import type { PackLibrary } from "../packs";
import "./city-pack-form.css";

interface CityPackFormProps {
  packLibrary: PackLibrary;
}

/**
 * Import a whole city — its map view plus every dataset its author curated —
 * from a URL. This is the path that needs no fork and no pull request; the
 * repo route exists for sources whose servers refuse browser requests.
 */
export function CityPackForm({ packLibrary }: CityPackFormProps) {
  const { importedPacks, sessionPack, importing } = packLibrary;
  const { t } = useI18n();
  const fieldId = useId();
  const [packUrl, setPackUrl] = useState("");

  const trimmedUrl = packUrl.trim();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (trimmedUrl.length === 0 || importing) return;
    try {
      await packLibrary.importPack(trimmedUrl);
      setPackUrl("");
    } catch {
      // The status toast owns error reporting; keep the URL for a retry.
    }
  }

  return (
    <section className="city-pack-form" aria-labelledby={`${fieldId}-heading`}>
      <div className="form-header">
        <span className="section-label" id={`${fieldId}-heading`}>
          {t("pack.heading")}
        </span>
      </div>
      <p className="city-pack-form__explainer">{t("pack.explainer")}</p>

      <form className="city-pack-form__row" onSubmit={handleSubmit}>
        <div className="kern-form-input city-pack-form__field">
          <label className="kern-label" htmlFor={`${fieldId}-url`}>
            {t("pack.url")}
          </label>
          <input
            id={`${fieldId}-url`}
            name="packUrl"
            className="kern-form-input__input"
            type="url"
            placeholder="https://.../city-pack.json"
            autoComplete="off"
            spellCheck={false}
            value={packUrl}
            onChange={(event) => setPackUrl(event.target.value)}
          />
        </div>
        <KernButton
          type="submit"
          variant="secondary"
          icon="download"
          iconPosition="left"
          disabled={importing || trimmedUrl.length === 0}
        >
          {importing ? t("pack.importing") : t("pack.import")}
        </KernButton>
      </form>

      {(sessionPack || importedPacks.length > 0) && (
        <>
          <span className="section-label" id={`${fieldId}-list`}>
            {t("pack.importedHeading")}
          </span>
          <ul className="city-pack-form__list" aria-labelledby={`${fieldId}-list`}>
            {sessionPack && (
              <PackRow
                key={sessionPack.city.id}
                name={sessionPack.city.name}
                badge={t("pack.sessionBadge")}
              >
                <KernButton
                  type="button"
                  variant="tertiary"
                  icon="check"
                  iconPosition="left"
                  onClick={packLibrary.saveSessionPack}
                >
                  {t("pack.keepSession")}
                </KernButton>
              </PackRow>
            )}
            {importedPacks.map((pack) => (
              <PackRow key={pack.city.id} name={pack.city.name}>
                <KernButton
                  type="button"
                  variant="tertiary"
                  icon="delete"
                  iconPosition="left"
                  alt={`${t("pack.remove")}: ${pack.city.name}`}
                  onClick={() => packLibrary.removePack(pack.city.id)}
                >
                  {t("pack.remove")}
                </KernButton>
              </PackRow>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** One city in the list: its name, an optional provenance badge, one action. */
function PackRow({
  name,
  badge,
  children,
}: {
  name: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <li className="city-pack-form__item">
      <span className="city-pack-form__name">
        {name}
        {badge && (
          <span className="kern-badge kern-badge--info dataset-badge">{badge}</span>
        )}
      </span>
      {children}
    </li>
  );
}
