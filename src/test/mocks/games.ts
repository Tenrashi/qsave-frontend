import type { Game, SaveFile } from "@/domain/types";

export const MOCK_DATE = new Date("2026-03-14T12:00:00Z");

export const sims4Save1: SaveFile = {
  name: "Slot_001.save",
  path: "/saves/sims4/Slot_001.save",
  sizeBytes: 12_582_912,
  lastModified: MOCK_DATE,
  gameName: "The Sims 4",
};

export const sims4Save2: SaveFile = {
  name: "Slot_002.save",
  path: "/saves/sims4/Slot_002.save",
  sizeBytes: 8_388_608,
  lastModified: MOCK_DATE,
  gameName: "The Sims 4",
};

export const cyberpunkSave1: SaveFile = {
  name: "manual.save",
  path: "/saves/cyberpunk/manual.save",
  sizeBytes: 2048,
  lastModified: MOCK_DATE,
  gameName: "Cyberpunk 2077",
};

export const eldenRingSave1: SaveFile = {
  name: "save.sl2",
  path: "/saves/elden/save.sl2",
  sizeBytes: 1024,
  lastModified: MOCK_DATE,
  gameName: "Elden Ring",
};

export const sims4Game: Game = {
  name: "The Sims 4",
  steamId: 1222670,
  savePaths: ["/saves/sims4"],
  saveFiles: [sims4Save1, sims4Save2],
};

export const cyberpunkGame: Game = {
  name: "Cyberpunk 2077",
  savePaths: ["/saves/cyberpunk"],
  saveFiles: [cyberpunkSave1],
};

export const eldenRingGame: Game = {
  name: "Elden Ring",
  savePaths: ["/saves/elden"],
  saveFiles: [eldenRingSave1],
};

export const manualGame: Game = {
  name: "My Custom Game",
  savePaths: ["/saves/custom"],
  saveFiles: [
    {
      name: "save.dat",
      path: "/saves/custom/save.dat",
      sizeBytes: 4096,
      lastModified: MOCK_DATE,
      gameName: "My Custom Game",
    },
  ],
  isManual: true,
};

export const emptyManualGame: Game = {
  name: "Empty Manual Game",
  savePaths: ["/saves/empty"],
  saveFiles: [],
  isManual: true,
};

export const twoGames: Game[] = [sims4Game, cyberpunkGame];
