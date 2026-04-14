import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";

const KOFI_URL = "https://ko-fi.com/qsave";

export const Support = () => {
  const { t } = useTranslation();

  return (
    <section id="support" className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-3xl px-6 py-20 text-center sm:py-24">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("support.heading")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          {t("support.body")}
        </p>
        <div className="mt-8">
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 font-medium"
          >
            <Heart className="size-5" aria-hidden />
            <span>{t("support.button")}</span>
          </a>
        </div>
      </div>
    </section>
  );
};
