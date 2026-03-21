import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SYNC_STATUS } from "@/domain/types";
import { SyncStatusIcon } from "./SyncStatusIcon";

describe("SyncStatusIcon", () => {
  it("shows spinning icon when syncing", () => {
    render(<SyncStatusIcon status={SYNC_STATUS.syncing} isSynced={false} />);
    expect(screen.getByRole("img", { name: "syncing" })).toBeInTheDocument();
  });

  it("shows spinning icon when restoring", () => {
    render(<SyncStatusIcon status={SYNC_STATUS.restoring} isSynced={false} />);
    expect(screen.getByRole("img", { name: "restoring" })).toBeInTheDocument();
  });

  it("shows error icon on error status", () => {
    render(<SyncStatusIcon status={SYNC_STATUS.error} isSynced={false} />);
    expect(screen.getByRole("img", { name: "sync error" })).toBeInTheDocument();
  });

  it("shows checkmark when synced and idle", () => {
    render(<SyncStatusIcon status={SYNC_STATUS.idle} isSynced={true} />);
    expect(screen.getByRole("img", { name: "synced" })).toBeInTheDocument();
  });

  it("renders nothing when idle and not synced", () => {
    const { container } = render(
      <SyncStatusIcon status={SYNC_STATUS.idle} isSynced={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("prioritizes syncing status over isSynced flag", () => {
    render(<SyncStatusIcon status={SYNC_STATUS.syncing} isSynced={true} />);
    expect(screen.getByRole("img", { name: "syncing" })).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "synced" }),
    ).not.toBeInTheDocument();
  });
});
