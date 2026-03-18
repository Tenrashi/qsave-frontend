import { watchImmediate, type UnwatchFn } from "@tauri-apps/plugin-fs";

type WatchCallback = (paths: string[]) => void;

const watchers = new Map<string, UnwatchFn>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

const DEBOUNCE_MS = 2000;

export const startWatching = async (
  directories: string[],
  onChange: WatchCallback,
): Promise<void> => {
  for (const dir of directories) {
    if (watchers.has(dir)) continue;

    try {
      const unwatch = await watchImmediate(dir, (event) => {
        const paths = Array.isArray(event.paths) ? event.paths : [event.paths];
        const changedPaths = paths.filter((path): path is string => typeof path === "string");
        if (changedPaths.length === 0) return;

        // Debounce: games often write temp file + rename
        const existing = debounceTimers.get(dir);
        if (existing) clearTimeout(existing);

        debounceTimers.set(
          dir,
          setTimeout(() => {
            debounceTimers.delete(dir);
            onChange(changedPaths);
          }, DEBOUNCE_MS),
        );
      }, { recursive: true });

      watchers.set(dir, unwatch);
    } catch {
      // failed to watch directory — skip silently
    }
  }
};

export const stopWatching = async (directory?: string): Promise<void> => {
  if (directory) {
    const unwatch = watchers.get(directory);
    if (unwatch) {
      unwatch();
      watchers.delete(directory);
    }
    const timer = debounceTimers.get(directory);
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete(directory);
    }
    return;
  }

  for (const unwatch of watchers.values()) {
    unwatch();
  }
  watchers.clear();
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
};

export const getWatchedDirectories = (): string[] =>
  Array.from(watchers.keys());
