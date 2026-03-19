const AUTO_SYNC_DELAY_MS = 30_000;
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const scheduleAutoSync = (gameName: string, onSync: () => void): void => {
  cancelAutoSync(gameName);
  const timer = setTimeout(() => {
    pendingTimers.delete(gameName);
    onSync();
  }, AUTO_SYNC_DELAY_MS);
  pendingTimers.set(gameName, timer);
};

export const cancelAutoSync = (gameName: string): void => {
  const timer = pendingTimers.get(gameName);
  if (!timer) return;
  clearTimeout(timer);
  pendingTimers.delete(gameName);
};

export const cancelAllAutoSyncs = (): void => {
  for (const timer of pendingTimers.values()) {
    clearTimeout(timer);
  }
  pendingTimers.clear();
};

export const hasPendingSync = (gameName: string): boolean =>
  pendingTimers.has(gameName);
