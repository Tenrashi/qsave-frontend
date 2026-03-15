import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { useRef } from "react";
import { twoGames } from "@/test/mocks/games";
import { SavesList, type SavesListProps } from "./SavesList";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 64,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 64,
        size: 56,
        key: i,
      })),
  }),
}));

const Wrapper = (props: Omit<SavesListProps, "scrollRef">) => {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} style={{ height: 400, overflow: "auto" }}>
      <SavesList {...props} scrollRef={ref} />
    </div>
  );
};

describe("SavesList", () => {
  it("shows empty state when no games", () => {
    renderWithProviders(<Wrapper games={[]} />);
    expect(screen.getByText("No games detected")).toBeInTheDocument();
  });

  it("renders game cards for detected games", () => {
    renderWithProviders(<Wrapper games={twoGames} />);
    expect(screen.getByText("The Sims 4")).toBeInTheDocument();
    expect(screen.getByText("Cyberpunk 2077")).toBeInTheDocument();
  });
});
