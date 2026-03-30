import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { sims4Game, cyberpunkGame, eldenRingGame } from "@/test/mocks/games";
import { useGameDetectionNotify } from "./useGameDetectionNotify";

vi.mock("@/lib/notify/notify", () => ({
  notify: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      `${key}${opts ? `|${JSON.stringify(opts)}` : ""}`,
  }),
}));

import { notify } from "@/lib/notify/notify";

const mockNotify = vi.mocked(notify);

beforeEach(() => {
  mockNotify.mockClear();
});

describe("useGameDetectionNotify", () => {
  it("does not notify when games is undefined", () => {
    renderHook(() => useGameDetectionNotify(undefined));
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("does not notify on initial load", () => {
    renderHook(() => useGameDetectionNotify([sims4Game, cyberpunkGame]));
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("notifies with game name when one new game is detected", () => {
    const { rerender } = renderHook(
      ({ games }) => useGameDetectionNotify(games),
      { initialProps: { games: [sims4Game] } },
    );

    rerender({ games: [sims4Game, cyberpunkGame] });

    expect(mockNotify).toHaveBeenCalledOnce();
    expect(mockNotify.mock.calls[0][1]).toContain(
      "notifications.gameDetectedOne",
    );
    expect(mockNotify.mock.calls[0][1]).toContain("Cyberpunk 2077");
  });

  it("notifies with count when multiple new games are detected", () => {
    const { rerender } = renderHook(
      ({ games }) => useGameDetectionNotify(games),
      { initialProps: { games: [sims4Game] } },
    );

    rerender({ games: [sims4Game, cyberpunkGame, eldenRingGame] });

    expect(mockNotify).toHaveBeenCalledOnce();
    expect(mockNotify.mock.calls[0][1]).toContain(
      "notifications.gameDetectedOther",
    );
    expect(mockNotify.mock.calls[0][1]).toContain('"count":2');
  });

  it("does not notify when no new games appear", () => {
    const { rerender } = renderHook(
      ({ games }) => useGameDetectionNotify(games),
      { initialProps: { games: [sims4Game, cyberpunkGame] } },
    );

    rerender({ games: [sims4Game, cyberpunkGame] });

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("does not notify when games are removed", () => {
    const { rerender } = renderHook(
      ({ games }) => useGameDetectionNotify(games),
      { initialProps: { games: [sims4Game, cyberpunkGame] } },
    );

    rerender({ games: [sims4Game] });

    expect(mockNotify).not.toHaveBeenCalled();
  });
});
