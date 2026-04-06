import { describe, it, expect } from "vitest";
import { sims4Game, registryOnlyGame, cloudOnlyGame } from "@/test/mocks/games";
import { isRegistryOnly } from "./game";

describe("isRegistryOnly", () => {
  it("returns true when game has registry keys but no save files", () => {
    expect(isRegistryOnly(registryOnlyGame)).toBe(true);
  });

  it("returns false when game has save files", () => {
    expect(isRegistryOnly(sims4Game)).toBe(false);
  });

  it("returns false when game has no registry keys and no save files", () => {
    expect(isRegistryOnly(cloudOnlyGame)).toBe(false);
  });

  it("returns false when game has both registry keys and save files", () => {
    const game = {
      ...sims4Game,
      registryKeys: ["HKEY_CURRENT_USER/Software/TestGame"],
    };
    expect(isRegistryOnly(game)).toBe(false);
  });

  it("returns false when registryKeys is undefined", () => {
    const game = { ...sims4Game, registryKeys: undefined };
    expect(isRegistryOnly(game)).toBe(false);
  });
});
