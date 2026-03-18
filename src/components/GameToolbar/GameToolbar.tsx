import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/SearchBar/SearchBar";
import { AddGameDialog } from "@/components/AddGameDialog/AddGameDialog";

export type GameToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
};

export const GameToolbar = ({ search, onSearchChange }: GameToolbarProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
      <div className="flex-1">
        <SearchBar value={search} onChange={onSearchChange} />
      </div>
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
