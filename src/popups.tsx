import type { ReactElement, ReactNode } from "react";
import { idEditLink, josmAddNodeLink, josmZoomLink, osmObjectLink } from "./editors";
import { type TranslationKey, t } from "./i18n";
import { expectedTags } from "./tag-matching";
import type { Dataset, DatasetPoint, PointMatch } from "./types";

export type PopupSide = "official" | "osm";

const DETAIL_LIMIT = 6;

interface DetailField {
  key: string;
  label: string;
  value: string;
  sourceKeys: string[];
}

interface DetailSelection {
  fields: DetailField[];
  hiddenCount: number;
}

const TITLE_KEYS = [
  "name",
  "name:de",
  "name_de",
  "official_name",
  "alt_name",
  "bezeichnung",
  "titel",
  "title",
];

const CATEGORY_KEYS = [
  "gruppenname_de",
  "gruppe",
  "category",
  "type",
  "typ",
  "art",
  "amenity",
  "leisure",
  "tourism",
  "shop",
  "sport",
];

const PRIORITY_KEYS = [
  ...TITLE_KEYS,
  ...CATEGORY_KEYS,
  "operator",
  "brand",
  "ref",
  "official_ref",
  "website",
  "contact:website",
  "phone",
  "contact:phone",
  "email",
  "contact:email",
  "opening_hours",
  "capacity",
  "access",
  "wheelchair",
  "fee",
  "covered",
  "bicycle_parking",
  "parking",
  "recycling_type",
  "description",
  "note",
];

const FIELD_LABELS: Record<string, TranslationKey> = {
  access: "popup.field.access",
  amenity: "popup.field.type",
  art: "popup.field.category",
  bicycle_parking: "popup.field.parking",
  brand: "popup.field.brand",
  capacity: "popup.field.capacity",
  category: "popup.field.category",
  "contact:email": "popup.field.email",
  "contact:phone": "popup.field.phone",
  "contact:website": "popup.field.website",
  covered: "popup.field.covered",
  description: "popup.field.description",
  email: "popup.field.email",
  fee: "popup.field.fee",
  gruppenname_de: "popup.field.category",
  leisure: "popup.field.type",
  name: "popup.field.name",
  name_de: "popup.field.name",
  "name:de": "popup.field.name",
  note: "popup.field.note",
  official_name: "popup.field.name",
  official_ref: "popup.field.reference",
  opening_hours: "popup.field.openingHours",
  operator: "popup.field.operator",
  parking: "popup.field.parking",
  phone: "popup.field.phone",
  recycling_type: "popup.field.type",
  ref: "popup.field.reference",
  shop: "popup.field.type",
  sport: "popup.field.type",
  title: "popup.field.name",
  titel: "popup.field.name",
  tourism: "popup.field.type",
  type: "popup.field.type",
  typ: "popup.field.type",
  website: "popup.field.website",
  wheelchair: "popup.field.wheelchair",
};

function scalarValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") {
    return value ? t("popup.booleanYes") : t("popup.booleanNo");
  }
  if (Array.isArray(value)) {
    const values = value.flatMap((entry) => {
      const scalar = scalarValue(entry);
      return scalar === null ? [] : [scalar];
    });
    return values.length ? values.join(", ") : null;
  }
  return null;
}

function propertyValue(
  props: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = scalarValue(props[key]);
    if (value !== null) return value;
  }
  return null;
}

function pointTitle(point: DatasetPoint): string | null {
  return propertyValue(point.props, TITLE_KEYS) ?? point.osmRef ?? null;
}

function fieldLabel(key: string): string {
  const labelKey = FIELD_LABELS[key];
  return labelKey ? t(labelKey) : key.replaceAll("_", " ");
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener">
      {children}
    </a>
  );
}

function PopupTitle({ title }: { title: string | null }) {
  return title ? <div className="popup-title">{title}</div> : null;
}

/** "View OSM" + "Edit in iD" footer shared by the matched/needs-tagging popups. */
function OsmEditActions({ osm }: { osm: DatasetPoint }) {
  const link = osmObjectLink(osm);
  return (
    <div className="actions">
      {link && <ExternalLink href={link}>{t("popup.viewOsm")}</ExternalLink>}
      <ExternalLink href={idEditLink(osm)}>{t("popup.editId")}</ExternalLink>
    </div>
  );
}

/** Official + OSM detail cards, with the requested side expanded. */
function MatchDetailSections({
  pair,
  selectedSide,
}: {
  pair: PointMatch;
  selectedSide: PopupSide;
}) {
  return (
    <>
      <DetailSection
        point={pair.official}
        label={t("popup.officialRecord")}
        open={selectedSide === "official"}
      />
      <DetailSection
        point={pair.osm}
        label={t("popup.osmObject")}
        open={selectedSide === "osm"}
      />
    </>
  );
}

function addressField(props: Record<string, unknown>): DetailField | null {
  const direct = propertyValue(props, ["addr:full", "address", "adresse"]);
  if (direct) {
    return {
      key: "address",
      label: t("popup.field.address"),
      value: direct,
      sourceKeys: ["addr:full", "address", "adresse"],
    };
  }

  const street = propertyValue(props, ["addr:street", "strasse", "straße", "street"]);
  const houseNumber = propertyValue(props, [
    "addr:housenumber",
    "hausnummer",
    "housenumber",
  ]);
  const postcode = propertyValue(props, ["addr:postcode", "plz", "postcode"]);
  const city = propertyValue(props, ["addr:city", "ort", "city"]);
  const line1 = [street, houseNumber].filter(Boolean).join(" ");
  const line2 = [postcode, city].filter(Boolean).join(" ");
  const value = [line1, line2].filter(Boolean).join(", ");
  if (!value) return null;

  return {
    key: "address",
    label: t("popup.field.address"),
    value,
    sourceKeys: [
      "addr:street",
      "strasse",
      "straße",
      "street",
      "addr:housenumber",
      "hausnummer",
      "housenumber",
      "addr:postcode",
      "plz",
      "postcode",
      "addr:city",
      "ort",
      "city",
    ],
  };
}

function displayFields(point: DatasetPoint): DetailSelection {
  const usedKeys = new Set<string>();
  const candidates: DetailField[] = [];
  const address = addressField(point.props);
  if (address) candidates.push(address);

  for (const key of PRIORITY_KEYS) {
    const value = scalarValue(point.props[key]);
    if (value === null) continue;
    candidates.push({ key, label: fieldLabel(key), value, sourceKeys: [key] });
  }

  for (const [key, rawValue] of Object.entries(point.props)) {
    const value = scalarValue(rawValue);
    if (value === null) continue;
    candidates.push({ key, label: fieldLabel(key), value, sourceKeys: [key] });
  }

  const fields: DetailField[] = [];
  const seenValues = new Set<string>();
  for (const field of candidates) {
    if (field.sourceKeys.some((key) => usedKeys.has(key))) continue;
    const valueKey = `${field.label}\0${field.value}`;
    if (seenValues.has(valueKey)) continue;

    fields.push(field);
    seenValues.add(valueKey);
    for (const key of field.sourceKeys) usedKeys.add(key);
    if (fields.length === DETAIL_LIMIT) break;
  }

  const displayableKeys = Object.entries(point.props).flatMap(([key, value]) =>
    scalarValue(value) === null ? [] : [key],
  );
  const hiddenCount = displayableKeys.filter((key) => !usedKeys.has(key)).length;
  return { fields, hiddenCount };
}

function DetailSection({
  point,
  label,
  open = false,
}: {
  point: DatasetPoint;
  label: string;
  open?: boolean;
}) {
  const selection = displayFields(point);
  const coordinateValue = `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`;
  return (
    <details className="detail-card" open={open}>
      <summary className="detail-heading">
        <span>{label}</span>
        {point.osmRef && <span className="osm-ref detail-ref">{point.osmRef}</span>}
      </summary>
      <dl className="detail-list">
        {selection.fields.map((field) => (
          <div className="detail-row" key={`${field.key}:${field.value}`}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
        <div className="detail-row">
          <dt>{t("popup.field.coordinates")}</dt>
          <dd>{coordinateValue}</dd>
        </div>
      </dl>
      {selection.hiddenCount > 0 && (
        <p className="hint">
          {t("popup.andMoreFields", { count: selection.hiddenCount })}
        </p>
      )}
    </details>
  );
}

function MappedTagsTable({
  point,
  dataset,
  open = true,
}: {
  point: DatasetPoint;
  dataset: Dataset;
  open?: boolean;
}) {
  const tags = Object.entries(expectedTags(point, dataset));
  if (tags.length === 0) return null;
  return (
    <details className="detail-card" open={open}>
      <summary className="detail-heading">
        <span>{t("popup.mappedTags")}</span>
      </summary>
      <table className="pp">
        <tbody>
          {tags.map(([key, value]) => (
            <tr key={key}>
              <td>{key}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function AttributeGapTable({
  gaps,
  valueLabel,
}: {
  gaps: PointMatch["attributeGaps"];
  valueLabel: string;
}) {
  if (gaps.length === 0) return null;
  return (
    <table className="pp">
      <thead>
        <tr>
          <th>{t("popup.key")}</th>
          <th>OSM</th>
          <th>{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {gaps.map((gap) => (
          <tr key={gap.key}>
            <td>{gap.key}</td>
            <td>{gap.osmValue ?? "—"}</td>
            <td>
              {valueLabel === t("popup.expected") ? (
                <strong>{gap.expected}</strong>
              ) : (
                gap.expected
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function missingPopup(point: DatasetPoint, dataset: Dataset): ReactElement {
  return (
    <div className="popup popup--missing">
      <strong>{t("popup.missingTitle")}</strong>
      <PopupTitle title={pointTitle(point)} />
      <p className="hint">{t("popup.missingHint")}</p>
      <MappedTagsTable point={point} dataset={dataset} />
      <DetailSection point={point} label={t("popup.officialRecord")} />
      <div className="actions">
        <ExternalLink href={idEditLink(point)}>{t("popup.surveyId")}</ExternalLink>
        <a href={josmAddNodeLink(point, dataset)}>{t("popup.precreateJosm")}</a>
      </div>
    </div>
  );
}

export function matchedPopup(
  pair: PointMatch,
  selectedSide: PopupSide = "official",
): ReactElement {
  return (
    <div className="popup popup--matched">
      <strong>
        {t("popup.matchedTitle")} <span className="dist-badge">{pair.distanceM} m</span>
      </strong>
      <PopupTitle title={pointTitle(pair.official) ?? pointTitle(pair.osm)} />
      {pair.attributeGaps.length > 0 ? (
        <>
          <p className="hint">{t("popup.attributeGaps")}</p>
          <AttributeGapTable
            gaps={pair.attributeGaps}
            valueLabel={t("popup.official")}
          />
        </>
      ) : (
        <p className="hint all-good">{t("popup.tagsComplete")}</p>
      )}
      <OsmEditActions osm={pair.osm} />
      <MatchDetailSections pair={pair} selectedSide={selectedSide} />
    </div>
  );
}

export function needsTaggingPopup(
  pair: PointMatch,
  selectedSide: PopupSide = "official",
): ReactElement {
  return (
    <div className="popup popup--tagging">
      <strong>{t("popup.tagDifferencesTitle")}</strong>
      <span className="dist-badge">{pair.distanceM} m</span>
      <PopupTitle title={pointTitle(pair.official) ?? pointTitle(pair.osm)} />
      {pair.osm.osmRef && <div className="osm-ref">{pair.osm.osmRef}</div>}
      <p className="hint">{t("popup.tagDifferencesHint")}</p>
      <AttributeGapTable gaps={pair.attributeGaps} valueLabel={t("popup.expected")} />
      <MatchDetailSections pair={pair} selectedSide={selectedSide} />
      <OsmEditActions osm={pair.osm} />
    </div>
  );
}

export function reviewPopup(point: DatasetPoint): ReactElement {
  const link = osmObjectLink(point);
  return (
    <div className="popup popup--review">
      <strong>{t("popup.osmOnlyTitle")}</strong>
      <PopupTitle title={pointTitle(point)} />
      <p className="hint">{t("popup.osmOnlyHint")}</p>
      <DetailSection point={point} label={t("popup.osmObject")} open={true} />
      <div className="actions">
        {link && <ExternalLink href={link}>{t("popup.viewOsm")}</ExternalLink>}
        <a href={josmZoomLink(point)}>{t("popup.inspectJosm")}</a>
      </div>
    </div>
  );
}
