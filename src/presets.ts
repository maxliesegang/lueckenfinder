import type { Dataset } from "./types";

/**
 * Shipped, read-only preset mappings. To change these or add an official
 * Karlsruhe dataset, open a pull request against this file — that is the
 * deliberate "uneditable in the app, editable via review" contribution path.
 *
 * The build-time fetch script (scripts/fetch-presets.ts) can cache each
 * geojsonUrl into public/presets-data/<id>.geojson so the app can load it
 * same-origin (avoids CORS) and use a reproducible snapshot.
 *
 * LICENCE: verify each source's terms before adding it. Display attribution
 * through the `attribution` field, and confirm OSM compatibility before using
 * source data for edits. Frame suggestions as "go verify on the ground", not
 * "copy this".
 */
export const PRESETS: readonly Dataset[] = Object.freeze<Dataset[]>([
  {
    id: "ka-glass-containers",
    label: "Altglascontainer Karlsruhe",
    source: "preset",
    geojsonUrl:
      "https://geoportal.karlsruhe.de/ags04/rest/services/Hosted/Stadtplan_POIs_Entsorgungseinrichtungen/FeatureServer/0/query?where=gruppenname_de%3D%27Altglascontainer%27&outFields=name%2Cgruppenname_de&returnGeometry=true&f=geojson",
    overpassQuery: `nwr["amenity"="recycling"]["recycling:glass_bottles"="yes"]({{bbox}});
nwr["amenity"="recycling"]["recycling:glass"="yes"]({{bbox}});`,
    attribution: "Datenquelle: Geoportal Stadt Karlsruhe",
    sourceUrl: "https://geoportal.karlsruhe.de/",
    broadMatchQuery: 'nwr["amenity"="recycling"]({{bbox}});',
    tagMapping: {
      fixed: {
        amenity: "recycling",
        recycling_type: "container",
        "recycling:glass_bottles": "yes",
      },
    },
  },
  {
    id: "ka-battery-containers",
    label: "Altbatteriesammelbehälter Karlsruhe",
    source: "preset",
    geojsonUrl:
      "https://geoportal.karlsruhe.de/ags04/rest/services/Hosted/Stadtplan_POIs_Entsorgungseinrichtungen/FeatureServer/0/query?where=gruppenname_de%3D%27Altbatteriesammelbeh%C3%A4lter%27&outFields=name%2Cgruppenname_de&returnGeometry=true&f=geojson",
    overpassQuery: 'nwr["amenity"="recycling"]["recycling:batteries"="yes"]({{bbox}});',
    attribution: "Datenquelle: Geoportal Stadt Karlsruhe",
    sourceUrl: "https://geoportal.karlsruhe.de/",
    broadMatchQuery: 'nwr["amenity"="recycling"]({{bbox}});',
    tagMapping: {
      fixed: {
        amenity: "recycling",
        recycling_type: "container",
        "recycling:batteries": "yes",
      },
    },
  },
  {
    id: "ka-green-waste-containers",
    label: "Grünabfallcontainer Karlsruhe",
    source: "preset",
    geojsonUrl:
      "https://geoportal.karlsruhe.de/ags04/rest/services/Hosted/Stadtplan_POIs_Entsorgungseinrichtungen/FeatureServer/0/query?where=gruppenname_de%3D%27Gr%C3%BCnabfallcontainer%27&outFields=name%2Cgruppenname_de&returnGeometry=true&f=geojson",
    overpassQuery:
      'nwr["amenity"="recycling"]["recycling:green_waste"="yes"]({{bbox}});',
    attribution: "Datenquelle: Geoportal Stadt Karlsruhe",
    sourceUrl: "https://geoportal.karlsruhe.de/",
    broadMatchQuery: 'nwr["amenity"="recycling"]({{bbox}});',
    tagMapping: {
      fixed: {
        amenity: "recycling",
        recycling_type: "container",
        "recycling:green_waste": "yes",
      },
    },
  },
  {
    id: "ka-textile-containers",
    label: "Alttextilcontainer Karlsruhe",
    source: "preset",
    geojsonUrl:
      "https://geoportal.karlsruhe.de/ags04/rest/services/Hosted/Stadtplan_POIs_Entsorgungseinrichtungen/FeatureServer/0/query?where=gruppenname_de%3D%27Alttextilcontainer%27&outFields=name%2Cgruppenname_de&returnGeometry=true&f=geojson",
    overpassQuery: 'nwr["amenity"="recycling"]["recycling:clothes"="yes"]({{bbox}});',
    attribution: "Datenquelle: Geoportal Stadt Karlsruhe",
    sourceUrl: "https://geoportal.karlsruhe.de/",
    broadMatchQuery: 'nwr["amenity"="recycling"]({{bbox}});',
    tagMapping: {
      fixed: {
        amenity: "recycling",
        recycling_type: "container",
        "recycling:clothes": "yes",
      },
    },
  },
  {
    id: "ka-public-toilets",
    label: "Öffentliche Toiletten Karlsruhe",
    source: "preset",
    geojsonUrl:
      "https://geoportal.karlsruhe.de/ags04/rest/services/Hosted/Stadtplan_POIs_Behoerden_oeffentliche_Einrichtungen/FeatureServer/0/query?where=gruppenname_de%20LIKE%27%25%C3%96ffentliche%20Toiletten%25%27&outFields=name%2Cgruppenname_de&returnGeometry=true&f=geojson",
    overpassQuery: 'nwr["amenity"="toilets"]({{bbox}});',
    attribution: "Datenquelle: Geoportal Stadt Karlsruhe",
    sourceUrl: "https://geoportal.karlsruhe.de/",
    tagMapping: {
      fixed: {
        amenity: "toilets",
      },
    },
  },
  {
    id: "ka-disabled-parking-spaces",
    label: "Behindertenparkplätze Karlsruhe",
    source: "preset",
    geojsonUrl:
      "https://geoportal.karlsruhe.de/ags04/rest/services/Hosted/Stadtplan_POIs_Parken_Autoservices/FeatureServer/0/query?where=gruppenname_de%3D%27Behindertenparkpl%C3%A4tze%27&outFields=name%2Cgruppenname_de&returnGeometry=true&f=geojson",
    overpassQuery:
      'nwr["amenity"="parking_space"]["parking_space"="disabled"]({{bbox}});',
    attribution: "Datenquelle: Geoportal Stadt Karlsruhe",
    sourceUrl: "https://geoportal.karlsruhe.de/",
    tagMapping: {
      fixed: {
        amenity: "parking_space",
        parking_space: "disabled",
      },
    },
  },
  {
    id: "ka-car-parks",
    label: "Parkhäuser Karlsruhe",
    source: "preset",
    geojsonUrl:
      "https://mobil.trk.de/geoserver/TBA/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=TBA%3Aparkhaeuser&outputFormat=application%2Fjson&srsName=EPSG%3A4326&CQL_FILTER=gemeinde%3D%27Karlsruhe%27",
    overpassQuery: 'nwr["amenity"="parking"]({{bbox}});',
    attribution:
      "Datenquelle: Stadt Karlsruhe, Mobilitätsportal TechnologieRegion Karlsruhe (CC BY 4.0)",
    sourceUrl: "https://mobil.trk.de/",
    tagMapping: {
      fixed: {
        amenity: "parking",
      },
      fromProps: {
        capacity: "gesamte_parkplaetze",
      },
    },
  },
  {
    id: "ka-bicycle-parking",
    label: "Fahrradabstellplätze Karlsruhe",
    source: "preset",
    geojsonUrl:
      "https://mobil.trk.de/geoserver/TBA/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=TBA%3Afahrradanlagen&outputFormat=application%2Fjson&srsName=EPSG%3A4326&CQL_FILTER=gemeinde%3D%27Karlsruhe%27",
    overpassQuery: 'nwr["amenity"="bicycle_parking"]({{bbox}});',
    attribution:
      "Datenquelle: Stadt Karlsruhe, Mobilitätsportal TechnologieRegion Karlsruhe (CC BY 4.0)",
    sourceUrl: "https://mobil.trk.de/",
    tagMapping: {
      fixed: {
        amenity: "bicycle_parking",
      },
      fromProps: {
        capacity: "stellplaetze",
        covered: {
          property: "art",
          values: {
            Fahrradabstellanlage: "no",
            "Fahrradabstellanlage überdacht": "yes",
            Fahrradbox: "yes",
            Fahrradstation: "yes",
          },
        },
        bicycle_parking: {
          property: "art",
          values: {
            Fahrradbox: "lockers",
            Fahrradstation: "building",
          },
        },
        bike_ride: {
          property: "bike_and_ride",
          constant: "yes",
        },
        cargo_bike: {
          property: "lastenrad",
          values: {
            T: "yes",
          },
        },
      },
    },
  },
  {
    id: "ka-table-tennis-tables",
    label: "Tischtennisplatten Karlsruhe",
    source: "preset",
    geojsonUrl:
      "https://geoportal.karlsruhe.de/ags04/rest/services/Hosted/Stadtplan_POIs_Sportanlagen/FeatureServer/0/query?where=gruppenname_de%3D%27Tischtennisplatten%27&outFields=name%2Cgruppenname_de&returnGeometry=true&f=geojson",
    overpassQuery: 'nwr["leisure"="pitch"]["sport"="table_tennis"]({{bbox}});',
    attribution: "Datenquelle: Geoportal Stadt Karlsruhe",
    sourceUrl: "https://geoportal.karlsruhe.de/",
    broadMatchQuery: `nwr["sport"="table_tennis"]({{bbox}});
nwr["leisure"="table_tennis_table"]({{bbox}});`,
    tagMapping: {
      fixed: {
        leisure: "pitch",
        sport: "table_tennis",
      },
    },
  },
  {
    id: "ka-drinking-water",
    label: "Trinkwasserbrunnen Karlsruhe",
    source: "preset",
    geojsonUrl:
      "https://geoportal.karlsruhe.de/ags04/rest/services/Hosted/Stadtplan_POIs_Freizeit_Erholung/FeatureServer/0/query?where=gruppenname_de%3D%27Trinkwasserbrunnen%27&outFields=name%2Cgruppenname_de&returnGeometry=true&f=geojson",
    overpassQuery: 'nwr["amenity"="drinking_water"]({{bbox}});',
    attribution: "Datenquelle: Geoportal Stadt Karlsruhe",
    sourceUrl: "https://geoportal.karlsruhe.de/",
    broadMatchQuery: 'nwr["drinking_water"="yes"]({{bbox}});',
    tagMapping: {
      fixed: {
        amenity: "drinking_water",
      },
    },
  },
  {
    id: "ka-playgrounds",
    label: "Spielplätze Karlsruhe",
    source: "preset",
    geojsonUrl:
      "https://geoportal.karlsruhe.de/ags04/rest/services/Hosted/Stadtplan_POIs_Kinder_Jugendliche/FeatureServer/0/query?where=gruppenname_de%3D%27Spielpl%C3%A4tze%27&outFields=name%2Cgruppenname_de&returnGeometry=true&f=geojson",
    overpassQuery: 'nwr["leisure"="playground"]({{bbox}});',
    attribution: "Datenquelle: Geoportal Stadt Karlsruhe",
    sourceUrl: "https://geoportal.karlsruhe.de/",
    tagMapping: {
      fixed: {
        leisure: "playground",
      },
    },
  },
]);
