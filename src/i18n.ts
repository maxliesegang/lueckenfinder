import i18next from "i18next";
import { initReactI18next } from "react-i18next";

export const SUPPORTED_LANGUAGES = ["en", "de"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export type Variables = Record<string, string | number>;

const STORAGE_KEY = "lueckenfinder:language";

const en = {
  "app.title": "Lückenfinder — official data vs OpenStreetMap",
  "app.skipToMap": "Skip to map",
  "app.tagline":
    "Find gaps between official open city data and OpenStreetMap — then fix them by hand.",
  "language.label": "Language",
  "theme.label": "Theme",
  "theme.system": "System",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "dataset.heading": "Dataset",
  "dataset.filter": "Filter…",
  "dataset.filterAria": "Filter datasets",
  "dataset.selectAria": "Select dataset",
  "dataset.empty": "No datasets match.",
  "dataset.customBadge": "custom",
  "dataset.sourceLink": "Open data source",
  "legend.heading": "Results",
  "legend.total": "{{count}} features",
  "legend.showAll": "Show all",
  "legend.hideAll": "Hide all",
  "controls.addSource": "Add source",
  "controls.collapse": "Collapse panel",
  "controls.expand": "Expand panel",
  "menu.title": "App menu",
  "menu.openAria": "Open app menu",
  "settings.matchRadius": "Match radius",
  "settings.title": "Settings",
  "help.title": "About Lückenfinder",
  "about.disclaimerHeading": "Important",
  "about.disclaimer":
    "Lückenfinder only suggests possible OpenStreetMap changes. It never edits OSM automatically. Verify every find on the ground and check the official data licence before copying anything into OSM.",
  "about.attribution": "Map data © OpenStreetMap contributors",
  "settings.matchRadiusHint":
    "Distance to treat an official point and an OSM object as the same place.",
  "actions.compare": "Compare",
  "actions.remove": "Remove",
  "actions.done": "Done",
  "sourceForm.heading": "Dataset source",
  "sourceForm.label": "Label",
  "sourceForm.labelPlaceholder": "e.g. Drinking fountains",
  "sourceForm.geojsonUrl": "Official GeoJSON URL",
  "sourceForm.sourceUrl": "Data source URL (optional)",
  "sourceForm.overpassQuery": "Overpass query (use {{bboxToken}})",
  "actions.save": "Save",
  "actions.copyShareLink": "Copy share link",
  "actions.cancel": "Cancel",
  "status.networkError":
    "Could not connect. Check your network and the data source URL.",
  "status.error": "Error: {{message}}",
  "status.warning": "Warning: {{message}}",
  "status.found": "Found {{count}} features in {{seconds}}s.{{warning}}",
  "status.loadingOfficial": "Loading official data…",
  "status.queryingOsm": "Querying OpenStreetMap ({{count}} official points)…",
  "status.checkingPartial": "Checking for partially-tagged OSM objects…",
  "status.comparing": "Comparing…",
  "status.shareCopied": "Share link copied to clipboard.",
  "validation.bboxToken": 'Include the literal "{{bboxToken}}" token in the query.',
  "source.customAttribution": "Custom source — verify licence before editing OSM.",
  "error.clipboard": "Clipboard access is not available in this browser.",
  "error.matchRadius": "Match radius must be between 1 and 2,000 metres.",
  "error.noOfficialPoints": "Official dataset has no valid points.",
  "error.officialGeojson":
    "Could not load valid official GeoJSON. If this is a custom source, the server may not allow direct browser access (CORS).",
  "error.invalidOfficialData": "The official GeoJSON data is invalid.",
  "error.invalidOsmData": "OpenStreetMap returned invalid data.",
  "error.overpassReturned": "Overpass returned {{status}}.",
  "error.overpassTimeout": "The Overpass request timed out.",
  "error.invalidDataset": "The dataset definition is invalid.",
  "warning.relaxedQuery":
    "The relaxed OSM query failed, so some missing items may only need tags.",
  "bucket.missing.name": "Missing",
  "bucket.missing.action": "add to OSM",
  "bucket.tagDifferences.name": "Tag differences",
  "bucket.tagDifferences.action": "review tags",
  "bucket.matched.name": "Matched",
  "bucket.matched.action": "check tags",
  "bucket.osmOnly.name": "OSM only",
  "bucket.osmOnly.action": "review",
  "popup.andMore": "…and {{count}} more",
  "popup.andMoreFields": "{{count}} more fields hidden",
  "popup.tags": "{{count}} tags",
  "popup.mappedTags": "Mapped OSM tags:",
  "popup.officialRecord": "Official record",
  "popup.osmObject": "OSM object",
  "popup.booleanYes": "yes",
  "popup.booleanNo": "no",
  "popup.field.access": "Access",
  "popup.field.address": "Address",
  "popup.field.brand": "Brand",
  "popup.field.capacity": "Capacity",
  "popup.field.category": "Category",
  "popup.field.coordinates": "Coordinates",
  "popup.field.covered": "Covered",
  "popup.field.description": "Description",
  "popup.field.email": "Email",
  "popup.field.fee": "Fee",
  "popup.field.name": "Name",
  "popup.field.note": "Note",
  "popup.field.openingHours": "Opening hours",
  "popup.field.operator": "Operator",
  "popup.field.parking": "Parking",
  "popup.field.phone": "Phone",
  "popup.field.reference": "Reference",
  "popup.field.type": "Type",
  "popup.field.website": "Website",
  "popup.field.wheelchair": "Wheelchair",
  "popup.missingTitle": "Missing in OSM",
  "popup.missingHint": "Go verify on the ground, then add it.",
  "popup.surveyId": "Survey in iD",
  "popup.precreateJosm": "Pre-create in JOSM",
  "popup.matchedTitle": "Matched",
  "popup.attributeGaps": "Attribute gaps on the OSM object:",
  "popup.key": "Key",
  "popup.official": "Official",
  "popup.expected": "Expected",
  "popup.tagsComplete": "✓ Tags look complete",
  "popup.viewOsm": "View OSM object",
  "popup.editId": "Edit in iD",
  "popup.tagDifferencesTitle": "Tag differences",
  "popup.tagDifferencesHint": "Mapped official attributes differ from this OSM object:",
  "popup.osmOnlyTitle": "In OSM only — review",
  "popup.osmOnlyHint":
    "No official match. May be valid (official data isn't exhaustive) or stale. Check before changing.",
  "popup.inspectJosm": "Inspect in JOSM",
} as const;

export type TranslationKey = keyof typeof en;

const de: Record<TranslationKey, string> = {
  "app.title": "Lückenfinder — amtliche Daten vs. OpenStreetMap",
  "app.skipToMap": "Zur Karte springen",
  "app.tagline":
    "Finde Lücken zwischen offenen amtlichen Daten und OpenStreetMap — und behebe sie von Hand.",
  "language.label": "Sprache",
  "theme.label": "Darstellung",
  "theme.system": "System",
  "theme.light": "Hell",
  "theme.dark": "Dunkel",
  "dataset.heading": "Datensatz",
  "dataset.filter": "Filtern…",
  "dataset.filterAria": "Datensätze filtern",
  "dataset.selectAria": "Datensatz auswählen",
  "dataset.empty": "Keine passenden Datensätze.",
  "dataset.customBadge": "eigen",
  "dataset.sourceLink": "Datenquelle öffnen",
  "legend.heading": "Ergebnisse",
  "legend.total": "{{count}} Objekte",
  "legend.showAll": "Alle anzeigen",
  "legend.hideAll": "Alle ausblenden",
  "controls.addSource": "Quelle hinzufügen",
  "controls.collapse": "Panel einklappen",
  "controls.expand": "Panel ausklappen",
  "menu.title": "App-Menü",
  "menu.openAria": "App-Menü öffnen",
  "settings.matchRadius": "Abgleichradius",
  "settings.title": "Einstellungen",
  "help.title": "Über Lückenfinder",
  "about.disclaimerHeading": "Wichtig",
  "about.disclaimer":
    "Lückenfinder schlägt nur mögliche OpenStreetMap-Änderungen vor. Die App bearbeitet OSM niemals automatisch. Prüfe jeden Fund vor Ort und kläre die Lizenz der amtlichen Daten, bevor du etwas nach OSM übernimmst.",
  "about.attribution": "Kartendaten © OpenStreetMap-Mitwirkende",
  "settings.matchRadiusHint":
    "Abstand, ab dem ein amtlicher Punkt und ein OSM-Objekt als derselbe Ort gelten.",
  "actions.compare": "Vergleichen",
  "actions.remove": "Entfernen",
  "actions.done": "Fertig",
  "sourceForm.heading": "Datenquelle",
  "sourceForm.label": "Bezeichnung",
  "sourceForm.labelPlaceholder": "z. B. Trinkbrunnen",
  "sourceForm.geojsonUrl": "URL des amtlichen GeoJSON",
  "sourceForm.sourceUrl": "URL der Datenquelle (optional)",
  "sourceForm.overpassQuery": "Overpass-Abfrage (mit {{bboxToken}})",
  "actions.save": "Speichern",
  "actions.copyShareLink": "Freigabelink kopieren",
  "actions.cancel": "Abbrechen",
  "status.networkError":
    "Verbindung fehlgeschlagen. Prüfe das Netzwerk und die URL der Datenquelle.",
  "status.error": "Fehler: {{message}}",
  "status.warning": "Warnung: {{message}}",
  "status.found": "{{count}} Objekte in {{seconds}} s gefunden.{{warning}}",
  "status.loadingOfficial": "Amtliche Daten werden geladen…",
  "status.queryingOsm": "OpenStreetMap wird abgefragt ({{count}} amtliche Objekte)…",
  "status.checkingPartial": "Teilweise getaggte OpenStreetMap-Objekte werden gesucht…",
  "status.comparing": "Daten werden verglichen…",
  "status.shareCopied": "Freigabelink wurde in die Zwischenablage kopiert.",
  "validation.bboxToken":
    'Die Abfrage muss genau den Platzhalter "{{bboxToken}}" enthalten.',
  "source.customAttribution":
    "Eigene Quelle — Lizenz vor der Bearbeitung von OSM prüfen.",
  "error.clipboard":
    "Der Zugriff auf die Zwischenablage ist in diesem Browser nicht verfügbar.",
  "error.matchRadius": "Der Abgleichradius muss zwischen 1 und 2.000 Metern liegen.",
  "error.noOfficialPoints": "Der amtliche Datensatz enthält keine gültigen Punkte.",
  "error.officialGeojson":
    "Es konnte kein gültiges amtliches GeoJSON geladen werden. Bei einer eigenen Quelle erlaubt der Server möglicherweise keinen direkten Browserzugriff (CORS).",
  "error.invalidOfficialData": "Die amtlichen GeoJSON-Daten sind ungültig.",
  "error.invalidOsmData": "OpenStreetMap hat ungültige Daten zurückgegeben.",
  "error.overpassReturned": "Overpass hat den Status {{status}} zurückgegeben.",
  "error.overpassTimeout": "Die Overpass-Abfrage hat das Zeitlimit überschritten.",
  "error.invalidDataset": "Die Datensatzdefinition ist ungültig.",
  "warning.relaxedQuery":
    "Die erweiterte OSM-Abfrage ist fehlgeschlagen. Einige fehlende Objekte benötigen möglicherweise nur zusätzliche Tags.",
  "bucket.missing.name": "Fehlend",
  "bucket.missing.action": "zu OSM hinzufügen",
  "bucket.tagDifferences.name": "Tag-Abweichungen",
  "bucket.tagDifferences.action": "Tags prüfen",
  "bucket.matched.name": "Zugeordnet",
  "bucket.matched.action": "Tags prüfen",
  "bucket.osmOnly.name": "Nur in OSM",
  "bucket.osmOnly.action": "prüfen",
  "popup.andMore": "…und {{count}} weitere",
  "popup.andMoreFields": "{{count}} weitere Felder ausgeblendet",
  "popup.tags": "{{count}} Tags",
  "popup.mappedTags": "Zugeordnete OSM-Tags:",
  "popup.officialRecord": "Amtlicher Datensatz",
  "popup.osmObject": "OSM-Objekt",
  "popup.booleanYes": "ja",
  "popup.booleanNo": "nein",
  "popup.field.access": "Zugang",
  "popup.field.address": "Adresse",
  "popup.field.brand": "Marke",
  "popup.field.capacity": "Kapazität",
  "popup.field.category": "Kategorie",
  "popup.field.coordinates": "Koordinaten",
  "popup.field.covered": "Überdacht",
  "popup.field.description": "Beschreibung",
  "popup.field.email": "E-Mail",
  "popup.field.fee": "Gebühr",
  "popup.field.name": "Name",
  "popup.field.note": "Hinweis",
  "popup.field.openingHours": "Öffnungszeiten",
  "popup.field.operator": "Betreiber",
  "popup.field.parking": "Parken",
  "popup.field.phone": "Telefon",
  "popup.field.reference": "Referenz",
  "popup.field.type": "Typ",
  "popup.field.website": "Website",
  "popup.field.wheelchair": "Rollstuhl",
  "popup.missingTitle": "Fehlt in OSM",
  "popup.missingHint": "Vor Ort überprüfen und anschließend hinzufügen.",
  "popup.surveyId": "In iD erkunden",
  "popup.precreateJosm": "In JOSM vorbereiten",
  "popup.matchedTitle": "Zugeordnet",
  "popup.attributeGaps": "Attributlücken am OSM-Objekt:",
  "popup.key": "Schlüssel",
  "popup.official": "Amtlich",
  "popup.expected": "Erwartet",
  "popup.tagsComplete": "✓ Tags sehen vollständig aus",
  "popup.viewOsm": "OSM-Objekt anzeigen",
  "popup.editId": "In iD bearbeiten",
  "popup.tagDifferencesTitle": "Tag-Abweichungen",
  "popup.tagDifferencesHint":
    "Zugeordnete amtliche Attribute weichen von diesem OSM-Objekt ab:",
  "popup.osmOnlyTitle": "Nur in OSM — prüfen",
  "popup.osmOnlyHint":
    "Keine amtliche Entsprechung. Das Objekt kann gültig sein (amtliche Daten sind nicht vollständig) oder veraltet. Vor Änderungen prüfen.",
  "popup.inspectJosm": "In JOSM prüfen",
};

const TRANSLATED_MESSAGES: Partial<Record<string, TranslationKey>> = {
  "Clipboard access is not available in this browser.": "error.clipboard",
  "Match radius must be between 1 and 2,000 metres.": "error.matchRadius",
  "Official dataset has no valid points.": "error.noOfficialPoints",
  "Could not load valid official GeoJSON. If this is a custom source, the server may not allow direct browser access (CORS).":
    "error.officialGeojson",
  "The relaxed OSM query failed, so some missing items may only need tags.":
    "warning.relaxedQuery",
  "Overpass request timed out": "error.overpassTimeout",
  "Invalid Overpass JSON response": "error.invalidOsmData",
  "Invalid dataset definition": "error.invalidDataset",
  "Official data is not a GeoJSON FeatureCollection": "error.invalidOfficialData",
  "GeoJSON FeatureCollection has no features array": "error.invalidOfficialData",
};

export const resources: Record<
  Language,
  { translation: Record<TranslationKey, string> }
> = {
  en: { translation: en },
  de: { translation: de },
};

void i18next.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: "en",
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: {
    escapeValue: false,
  },
  initAsync: false,
});

i18next.on("languageChanged", (language) => {
  if (typeof window === "undefined" || !isLanguage(language)) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Language persistence is optional.
  }
});

export function getLanguage(): Language {
  const language = i18next.resolvedLanguage ?? i18next.language;
  return isLanguage(language) ? language : "en";
}

export function setLanguage(language: Language): void {
  void i18next.changeLanguage(language);
}

export function t(key: TranslationKey, variables: Variables = {}): string {
  return i18next.t(key, variables);
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(getLanguage(), options).format(value);
}

export function translateMessage(message: string): string {
  const key = TRANSLATED_MESSAGES[message];
  if (key) return t(key);
  if (/^(Invalid|Unsupported) GeoJSON /.test(message)) {
    return t("error.invalidOfficialData");
  }
  if (/^Invalid (Overpass|WGS84 coordinate at Overpass)/.test(message)) {
    return t("error.invalidOsmData");
  }
  const overpassStatus = /^Overpass returned (.+)$/.exec(message);
  return overpassStatus
    ? t("error.overpassReturned", { status: overpassStatus[1] })
    : message;
}

function detectLanguage(): Language {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLanguage(stored)) return stored;
    } catch {
      // Fall back to the browser language when storage is unavailable.
    }
  }
  const browserLanguage = typeof navigator === "undefined" ? "en" : navigator.language;
  return browserLanguage.toLowerCase().startsWith("de") ? "de" : "en";
}

function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

export default i18next;
