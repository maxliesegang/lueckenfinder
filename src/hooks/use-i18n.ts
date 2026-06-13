import { useTranslation } from "react-i18next";
import {
  formatNumber,
  getLanguage,
  type Language,
  setLanguage,
  t,
  translateMessage,
} from "../i18n";

export interface I18n {
  language: Language;
  setLanguage: (language: Language) => void;
  t: typeof t;
  formatNumber: typeof formatNumber;
  translateMessage: typeof translateMessage;
}

export function useI18n(): I18n {
  useTranslation();
  const language = getLanguage();
  return { language, setLanguage, t, formatNumber, translateMessage };
}
