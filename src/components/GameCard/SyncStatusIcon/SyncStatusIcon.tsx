import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { SYNC_STATUS } from "@/domain/types";
import type { SyncStatus } from "@/domain/types";

export type SyncStatusIconProps = {
  status: SyncStatus;
  isSynced: boolean;
};

export const SyncStatusIcon = ({ status, isSynced }: SyncStatusIconProps) => {
  if (status === SYNC_STATUS.syncing)
    return (
      <Loader2
        className="w-3.5 h-3.5 text-blue-500 animate-spin"
        role="img"
        aria-label="syncing"
        aria-hidden={false}
      />
    );
  if (status === SYNC_STATUS.restoring)
    return (
      <Loader2
        className="w-3.5 h-3.5 text-orange-500 animate-spin"
        role="img"
        aria-label="restoring"
        aria-hidden={false}
      />
    );
  if (status === SYNC_STATUS.error)
    return (
      <AlertCircle
        className="w-3.5 h-3.5 text-destructive"
        role="img"
        aria-label="sync error"
        aria-hidden={false}
      />
    );
  if (isSynced)
    return (
      <CheckCircle
        className="w-3.5 h-3.5 text-green-500"
        role="img"
        aria-label="synced"
        aria-hidden={false}
      />
    );
  return null;
};
