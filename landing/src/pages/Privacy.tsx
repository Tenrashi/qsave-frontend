import { useTranslation } from "react-i18next";
import { PrivacyEn } from "./PrivacyEn";
import { PrivacyFr } from "./PrivacyFr";

export const Privacy = () => {
  const { i18n } = useTranslation();
  if (i18n.language?.startsWith("fr")) return <PrivacyFr />;
  return <PrivacyEn />;
};
