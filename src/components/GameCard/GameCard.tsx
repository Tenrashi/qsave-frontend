import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { useSyncStore } from "@/stores/sync";
import { SYNC_STATUS } from "@/domain/types";
import type { Game } from "@/domain/types";
import { computeGameHash } from "@/lib/hash/hash";
import { GameBanner } from "./GameBanner/GameBanner";
import { CloudOnlyActions } from "./CloudOnlyActions/CloudOnlyActions";
import { LocalGameActions } from "./LocalGameActions/LocalGameActions";
import { SyncStatusIcon } from "./SyncStatusIcon/SyncStatusIcon";

export type GameCardProps = {
  game: Game;
};

export const GameCard = memo(({ game }: GameCardProps) => {
  const { t } = useTranslation();
  const { gameStatuses, syncFingerprints, hasBackup } = useSyncStore();

  const status = gameStatuses[game.name] ?? SYNC_STATUS.idle;
  const isBusy =
    status === SYNC_STATUS.syncing || status === SYNC_STATUS.restoring;
  const currentHash = computeGameHash(game.saveFiles, game.savePaths);
  const isSynced =
    syncFingerprints[game.name]?.hash === currentHash && hasBackup(game.name);

  return (
    <Card className="overflow-hidden !py-0">
      <div className="flex items-center h-14">
        <GameBanner steamId={game.steamId} />
        <div className="flex items-center justify-between flex-1 min-w-0 pl-2 pr-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="font-medium truncate">{game.name}</span>
            <SyncStatusIcon status={status} isSynced={isSynced} />
            {game.isManual && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                {t("games.manualBadge")}
              </span>
            )}
            {game.hasSteamCloud && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-medium">
                {t("games.steamCloudBadge")}
              </span>
            )}
            {game.isCloudOnly && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">
                {t("games.cloudBadge")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
            {game.isCloudOnly ? (
              <CloudOnlyActions game={game} status={status} isBusy={isBusy} />
            ) : (
              <LocalGameActions game={game} />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
});
