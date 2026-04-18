import { useTranslation } from "react-i18next";
import { TermsEn } from "./TermsEn";
import { TermsFr } from "./TermsFr";

export const Terms = () => {
  const { i18n } = useTranslation();
  if (i18n.language?.startsWith("fr")) return <TermsFr />;
  return <TermsEn />;
};
