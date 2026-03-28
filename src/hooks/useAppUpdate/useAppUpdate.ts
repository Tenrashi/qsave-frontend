import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "installing"
  | "error";

interface AppUpdate {
  status: UpdateStatus;
  version: string | null;
  error: string | null;
  install: () => Promise<void>;
}

export const useAppUpdate = (): AppUpdate => {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatePayload, setUpdatePayload] = useState<Awaited<
    ReturnType<typeof check>
  > | null>(null);

  useEffect(() => {
    const checkForUpdate = async () => {
      setStatus("checking");
      try {
        const update = await check();
        if (!update) {
          setStatus("idle");
          return;
        }
        setVersion(update.version);
        setUpdatePayload(update);
        setStatus("available");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    };

    checkForUpdate();
  }, []);

  const install = async () => {
    if (!updatePayload) return;

    try {
      setStatus("downloading");
      await updatePayload.downloadAndInstall((event) => {
        if (event.event === "Started") setStatus("downloading");
        if (event.event === "Finished") setStatus("installing");
      });
      await relaunch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  };

  return { status, version, error, install };
};
