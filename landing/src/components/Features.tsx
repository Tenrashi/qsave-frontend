import { useTranslation } from "react-i18next";
import { cn } from "../lib/cn";

type FeatureKey = "search" | "restore" | "manual";

const features: Array<{ key: FeatureKey; image: string }> = [
  { key: "search", image: "/screenshots/search.png" },
  { key: "restore", image: "/screenshots/restore.png" },
  { key: "manual", image: "/screenshots/manual-game.png" },
];

export const Features = () => {
  const { t } = useTranslation();

  return (
    <section className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("features.heading")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("features.subheading")}
          </p>
        </div>
        <div className="mt-20 flex flex-col gap-20 sm:gap-28">
          {features.map((feature, index) => (
            <article
              key={feature.key}
              className="grid items-center gap-10 lg:grid-cols-5 lg:gap-16"
            >
              <div
                className={cn(
                  "lg:col-span-3 overflow-hidden rounded-xl border border-border bg-card shadow-xl",
                  index % 2 === 1 && "lg:order-2",
                )}
              >
                <img
                  src={feature.image}
                  alt={t(`features.${feature.key}.alt`)}
                  className="w-full"
                />
              </div>
              <div className="lg:col-span-2">
                <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {t(`features.${feature.key}.title`)}
                </h3>
                <p className="mt-4 text-lg text-muted-foreground">
                  {t(`features.${feature.key}.description`)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
