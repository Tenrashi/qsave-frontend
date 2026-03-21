import { useTranslation } from "react-i18next";
import { Plus, CloudOff, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/SearchBar/SearchBar";
import { AddGameDialog } from "@/components/AddGameDialog/AddGameDialog";

export type GameToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  hideSteamCloud: boolean;
  onToggleHideSteamCloud: () => void;
};

export const GameToolbar = ({
  search,
  onSearchChange,
  hideSteamCloud,
  onToggleHideSteamCloud,
}: GameToolbarProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
      <div className="flex-1">
        <SearchBar value={search} onChange={onSearchChange} />
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={onToggleHideSteamCloud}
        title={t(
          hideSteamCloud ? "games.showSteamCloud" : "games.hideSteamCloud",
        )}
      >
        {hideSteamCloud ? (
          <CloudOff className="w-4 h-4" />
        ) : (
          <Cloud className="w-4 h-4" />
        )}
      </Button>
      <AddGameDialog
        trigger={
          <Button variant="outline" size="sm" className="shrink-0">
            <Plus className="w-4 h-4 mr-1.5" />
            {t("games.addGame")}
          </Button>
        }
      />
    </div>
  );
};
