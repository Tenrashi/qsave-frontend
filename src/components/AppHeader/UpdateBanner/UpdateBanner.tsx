import { useTranslation } from "react-i18next";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UpdateStatus } from "@/hooks/useAppUpdate/useAppUpdate";

export type UpdateBannerProps = {
  status: UpdateStatus;
  version: string;
  onInstall: () => void;
};

export const UpdateBanner = ({
  status,
  version,
  onInstall,
}: UpdateBannerProps) => {
  const { t } = useTranslation();
  const isInstalling = status === "downloading" || status === "installing";

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-primary/10 border-b text-sm">
      <span>{t("update.available", { version })}</span>
      <Button size="sm" onClick={onInstall} disabled={isInstalling}>
        {isInstalling ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5 mr-1.5" />
        )}
        {isInstalling ? t("update.installing") : t("update.install")}
      </Button>
    </div>
  );
};
