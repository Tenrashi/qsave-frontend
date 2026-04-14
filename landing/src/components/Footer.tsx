import { useTranslation } from "react-i18next";

export const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-10 text-center text-sm text-muted-foreground">
        {t("footer.tagline")}
      </div>
    </footer>
  );
};
