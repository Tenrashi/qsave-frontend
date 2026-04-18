import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Footer } from "../components/Footer";

type LegalLayoutProps = {
  title: string;
  updated: string;
  children: React.ReactNode;
};

export const LegalLayout = ({ title, updated, children }: LegalLayoutProps) => {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language || "en";
    document.title = `${title} — QSave`;
  }, [title, i18n.language]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <a
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("legal.backToHome")}
          </a>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("legal.lastUpdated", { date: updated })}
        </p>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-foreground/90 [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-sm [&_th]:font-medium [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
};
