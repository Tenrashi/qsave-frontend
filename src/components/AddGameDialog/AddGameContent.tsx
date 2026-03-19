import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogClose, DialogTitle } from "@/components/ui/dialog";
import { addManualGame } from "@/lib/store/store";
import { TAURI_COMMANDS, QUERY_KEYS } from "@/lib/constants/constants";
import { scanManualGame } from "@/services/scanner/scanner";
import type { Game } from "@/domain/types";

export type AddGameContentProps = {
  name: string;
  paths: string[];
  onNameChange: (name: string) => void;
  onPathsChange: (paths: string[]) => void;
  onClose: () => void;
};

export const AddGameContent = ({
  name,
  paths,
  onNameChange,
  onPathsChange,
  onClose,
}: AddGameContentProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const handleBrowse = async () => {
    try {
      const folder = await invoke<string | null>(TAURI_COMMANDS.pickFolder);
      if (!folder) return;
      if (!paths.includes(folder)) {
        onPathsChange([...paths, folder]);
      }
    } catch {
      // user cancelled or dialog unavailable — no-op
    }
  };

  const handleRemovePath = (path: string) => {
    onPathsChange(paths.filter((existing) => existing !== path));
  };

  const handleSubmit = async () => {
    if (!name.trim() || paths.length === 0) return;
    try {
      const trimmedName = name.trim();
      const [newGame] = await Promise.all([
        scanManualGame(trimmedName, paths),
        addManualGame(trimmedName, paths),
      ]);
      queryClient.setQueryData<Game[]>(QUERY_KEYS.games, (prev = []) =>
        [...prev, newGame].sort((gameA, gameB) =>
          gameA.name.localeCompare(gameB.name),
        ),
      );
      onClose();
    } catch {
      // store write failed — keep dialog open so user can retry
    }
  };

  const canSubmit = name.trim().length > 0 && paths.length > 0;

  return (
    <>
      <DialogTitle className="mb-4">{t("games.addGameTitle")}</DialogTitle>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            {t("games.gameNameLabel")}
          </label>
          <Input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={t("games.gameNamePlaceholder")}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            {t("games.savePathsLabel")}
          </label>
          {paths.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {t("games.noPathsAdded")}
            </p>
          ) : (
            <ul className="space-y-1">
              {paths.map((path) => (
                <li key={path} className="flex items-center gap-2 text-sm">
                  <FolderOpen className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
                    {path}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => handleRemovePath(path)}
                    title={t("games.removePath")}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-1"
            onClick={handleBrowse}
          >
            <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
            {t("games.browsePath")}
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <DialogClose render={<Button variant="ghost" />}>
          {t("games.cancel")}
        </DialogClose>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {t("games.add")}
        </Button>
      </div>
    </>
  );
};
