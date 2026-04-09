import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { useRef } from "react";
import { twoGames } from "@/test/mocks/games";
import { SavesList, type SavesListProps } from "./SavesList";

type VirtualizerOptions = {
  count: number;
  getScrollElement: () => HTMLElement | null;
  estimateSize: (index: number) => number;
};

const { mockUseVirtualizer } = vi.hoisted(() => ({
  mockUseVirtualizer: vi.fn((options: VirtualizerOptions) => {
    // Exercise the option callbacks on each render so coverage reflects
    // the wiring, not just the hook call. Tests can still assert the
    // observed values via mockUseVirtualizer.mock.calls[...].
    options.getScrollElement();
    options.estimateSize(0);
    return {
      getTotalSize: () => options.count * 64,
      getVirtualItems: () =>
        Array.from({ length: options.count }, (_, i) => ({
          index: i,
          start: i * 64,
          size: 56,
          key: i,
        })),
    };
  }),
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: mockUseVirtualizer,
}));

const Wrapper = (props: Omit<SavesListProps, "scrollElement">) => {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} style={{ height: 400, overflow: "auto" }}>
      <SavesList {...props} scrollElement={ref.current} />
    </div>
  );
};

describe("SavesList", () => {
  beforeEach(() => {
    mockUseVirtualizer.mockClear();
  });

  it("shows empty state when no games", () => {
    renderWithProviders(<Wrapper games={[]} />);
    expect(screen.getByText("games.noGamesDetected")).toBeInTheDocument();
  });

  it("shows add game button in empty state", () => {
    renderWithProviders(<Wrapper games={[]} />);
    expect(screen.getByText("games.addGame")).toBeInTheDocument();
  });

  it("renders game cards for detected games", () => {
    renderWithProviders(<Wrapper games={twoGames} />);
    expect(screen.getByText("The Sims 4")).toBeInTheDocument();
    expect(screen.getByText("Cyberpunk 2077")).toBeInTheDocument();
  });

  it("wires the scroll element and estimated row height into the virtualizer", () => {
    const scrollElement = document.createElement("div");
    renderWithProviders(
      <SavesList games={twoGames} scrollElement={scrollElement} />,
    );

    const options = mockUseVirtualizer.mock.calls[0][0];
    expect(options.count).toBe(twoGames.length);
    expect(options.getScrollElement()).toBe(scrollElement);
    expect(options.estimateSize(0)).toBe(60);
  });
});
