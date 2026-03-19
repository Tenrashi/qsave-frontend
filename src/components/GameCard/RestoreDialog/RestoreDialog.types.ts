import type { DriveBackup } from "@/domain/types";

export type RestoreState =
  | { step: "loading" }
  | { step: "select"; backups: DriveBackup[]; selected?: DriveBackup }
  | { step: "confirm" }
  | { step: "restoring" }
  | { step: "success"; fileCount: number }
  | { step: "error"; message: string };
