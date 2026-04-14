import { useState, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

type QA = {
  key: string;
  answer: ReactNode;
};

const useFaqs = (): QA[] => {
  const { t } = useTranslation();

  return [
    { key: "free", answer: t("faq.free.answer") },
    { key: "storage", answer: t("faq.storage.answer") },
    { key: "os", answer: t("faq.os.answer") },
    { key: "background", answer: t("faq.background.answer") },
    {
      key: "signing",
      answer: (
        <div className="space-y-3">
          <p>{t("faq.signing.intro")}</p>
          <p>
            <Trans
              i18nKey="faq.signing.windows"
              components={{ strong: <strong />, em: <em /> }}
            />
          </p>
          <p>
            <Trans
              i18nKey="faq.signing.macos"
              components={{ strong: <strong />, em: <em /> }}
            />
          </p>
          <p>{t("faq.signing.outro")}</p>
        </div>
      ),
    },
    { key: "uninstall", answer: t("faq.uninstall.answer") },
  ];
};

type ItemProps = { qa: QA; open: boolean; onToggle: () => void };

const Item = ({ qa, open, onToggle }: ItemProps) => {
  const { t } = useTranslation();
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-medium hover:text-muted-foreground"
      >
        <span>{t(`faq.${qa.key}.question`)}</span>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open && <div className="pb-5 text-muted-foreground">{qa.answer}</div>}
    </div>
  );
};

export const FAQ = () => {
  const { t } = useTranslation();
  const faqs = useFaqs();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="border-t border-border">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("faq.heading")}
        </h2>
        <div className="mt-10">
          {faqs.map((qa, index) => (
            <Item
              key={qa.key}
              qa={qa}
              open={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
