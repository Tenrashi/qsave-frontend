import { useTranslation } from "react-i18next";

export const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-10 text-center text-sm text-muted-foreground">
        <p>{t("footer.tagline")}</p>
        <nav className="mt-4 flex justify-center gap-6">
          <a href="/privacy" className="hover:text-foreground">
            {t("footer.privacy")}
          </a>
          <a href="/terms" className="hover:text-foreground">
            {t("footer.terms")}
          </a>
        </nav>
      </div>
    </footer>
  );
};
