import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/LanguageSelector/LanguageSelector";
import { APP_NAME } from "@/lib/constants";

export type AppHeaderProps = {
  isFetching: boolean;
  onRefresh: () => void;
};

export const AppHeader = ({ isFetching, onRefresh }: AppHeaderProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b">
      <h1 className="text-base font-bold tracking-tight">{APP_NAME}</h1>
      <div className="flex items-center gap-1">
        <LanguageSelector />
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          {t("app.refresh")}
        </Button>
      </div>
    </div>
  );
};
