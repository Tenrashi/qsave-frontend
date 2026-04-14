import { useTranslation } from "react-i18next";
import { Github } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";

export const Nav = () => {
  const { t } = useTranslation();

  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-end px-6">
        <div className="flex items-center gap-5">
          <LanguageSwitcher />
          <a
            href="https://github.com/Tenrashi/qsave"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            aria-label={t("footer.github")}
          >
            <Github className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t("footer.github")}</span>
          </a>
        </div>
      </div>
    </header>
  );
};
