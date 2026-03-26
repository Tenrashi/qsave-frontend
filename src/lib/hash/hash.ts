import type { SaveFile } from "@/domain/types";

const simpleHash = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return (hash >>> 0).toString(36);
};

const normalizeSeparators = (path: string): string => path.replace(/\\/g, "/");

const toRelativePath = (filePath: string, savePaths: string[]): string => {
  const normalizedFile = normalizeSeparators(filePath);
  const matchingBase = savePaths
    .map(normalizeSeparators)
    .filter((basePath) => normalizedFile.startsWith(basePath))
    .sort((pathA, pathB) => pathB.length - pathA.length)[0];

  if (!matchingBase) return normalizedFile;

  return normalizedFile.slice(matchingBase.length).replace(/^\//, "");
};

export const computeGameHash = (
  saveFiles: SaveFile[],
  savePaths: string[],
): string => {
  const sorted = [...saveFiles].sort((fileA, fileB) =>
    fileA.path.localeCompare(fileB.path),
  );
  const parts = sorted.map(
    (file) =>
      `${toRelativePath(file.path, savePaths)}:${file.sizeBytes}:${new Date(file.lastModified).getTime()}`,
  );
  return simpleHash(parts.join("|"));
};
