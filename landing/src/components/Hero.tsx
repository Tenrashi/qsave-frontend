import { useTranslation } from "react-i18next";
import { DownloadButtons } from "./DownloadButtons";
import { QLogo } from "./QLogo";

export const Hero = () => {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-12 text-center sm:pt-24 sm:pb-20">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60 blur-[120px] dark:bg-white/15"
            />
            <QLogo className="relative size-24 text-foreground" />
          </div>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          {t("hero.tagline1")}
          <br />
          <span className="text-muted-foreground">{t("hero.tagline2")}</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          {t("hero.subheadline")}
        </p>
        <div className="mt-10">
          <DownloadButtons />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-16 sm:pb-24">
        <div className="overflow-hidden rounded-xl border border-border shadow-2xl">
          <img src="/screenshots/main.png" alt="QSave" className="w-full" />
        </div>
      </div>
    </section>
  );
};
