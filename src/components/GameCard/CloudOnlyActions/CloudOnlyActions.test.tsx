import { describe, it, expect } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { SYNC_STATUS } from "@/domain/types";
import { cloudOnlyGame } from "@/test/mocks/games";
import { CloudOnlyActions } from "./CloudOnlyActions";

const renderActions = (
  overrides: Partial<Parameters<typeof CloudOnlyActions>[0]> = {},
) =>
  renderWithProviders(
    <CloudOnlyActions
      game={cloudOnlyGame}
      status={SYNC_STATUS.idle}
      isBusy={false}
      {...overrides}
    />,
  );

describe("CloudOnlyActions", () => {
  it("renders cloud hint text", () => {
    renderActions();
    expect(screen.getByText("games.cloudOnlyHint")).toBeInTheDocument();
  });

  it("renders restore button", () => {
    renderActions();
    expect(
      screen.getByRole("button", { name: "restore.tooltipPick" }),
    ).toBeInTheDocument();
  });

  it("disables restore button when busy", () => {
    renderActions({ isBusy: true });
    expect(
      screen.getByRole("button", { name: "restore.tooltipPick" }),
    ).toBeDisabled();
  });

  it("shows restoring spinner when status is restoring", () => {
    renderActions({ status: SYNC_STATUS.restoring });
    expect(screen.getByText("restore.restore")).toBeInTheDocument();
  });
});
