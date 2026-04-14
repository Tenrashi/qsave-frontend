import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { languages, type LanguageCode } from "../i18n";

export const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage ?? "en") as LanguageCode;

  return (
    <div className="relative inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
      <Globe className="size-4" aria-hidden />
      <span className="uppercase tabular-nums">{current}</span>
      <select
        value={current}
        onChange={(event) => i18n.changeLanguage(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={t("footer.language")}
      >
        {(Object.entries(languages) as Array<[LanguageCode, string]>).map(
          ([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ),
        )}
      </select>
    </div>
  );
};
