/**
 * Normalize a filesystem path to use forward slashes and strip trailing separators.
 * This ensures consistent cross-platform path comparison.
 */
export const normalizePath = (path: string): string =>
  path.replace(/\\/g, "/").replace(/\/+$/, "");

/**
 * Check if `fullPath` starts with `dir`, ensuring a proper directory boundary
 * so that "/Games/Saves" does not match "/Games/SavesBackup".
 */
export const pathStartsWith = (fullPath: string, dir: string): boolean => {
  const normalizedFull = normalizePath(fullPath);
  const normalizedDir = normalizePath(dir);
  return (
    normalizedFull.startsWith(normalizedDir) &&
    (normalizedFull.length === normalizedDir.length ||
      normalizedFull[normalizedDir.length] === "/")
  );
};

/**
 * Check if a normalized version of `path` already exists in `paths`.
 */
export const pathIncluded = (paths: string[], path: string): boolean => {
  const normalized = normalizePath(path);
  return paths.some((existing) => normalizePath(existing) === normalized);
};
