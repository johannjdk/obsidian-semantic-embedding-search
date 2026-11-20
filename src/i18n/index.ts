import { moment } from "obsidian";
import { de } from "./locales/de";
import { en, type TranslationKey } from "./locales/en";

type LocaleMap = Record<TranslationKey, string>;

const locales: Record<string, LocaleMap> = {
  en,
  de,
};

function detectLocale(): string {
  const raw = (moment.locale?.() || "en").toLowerCase();
  const base = raw.split(/[-_]/)[0];
  return base in locales ? base : "en";
}

export function t(
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const lang = detectLocale();
  const template = locales[lang]?.[key] ?? en[key];

  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, paramKey: string) => {
    const val = params[paramKey];
    return val !== undefined ? String(val) : match;
  });
}

export type { TranslationKey };
