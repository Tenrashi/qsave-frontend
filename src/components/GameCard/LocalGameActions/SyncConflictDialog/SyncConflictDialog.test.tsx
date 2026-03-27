import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, setupUser } from "@/test/test-utils";
import { SyncConflictDialog } from "./SyncConflictDialog";

describe("SyncConflictDialog", () => {
  const user = setupUser();
  const onOpenChange = vi.fn();
  const onUploadAnyway = vi.fn();
  const onDownloadCloud = vi.fn();

  const renderDialog = (open = true) =>
    renderWithProviders(
      <SyncConflictDialog
        open={open}
        onOpenChange={onOpenChange}
        onUploadAnyway={onUploadAnyway}
        onDownloadCloud={onDownloadCloud}
      />,
    );

  it("renders title and description when open", () => {
    renderDialog();
    expect(screen.getByText("sync.conflictTitle")).toBeInTheDocument();
    expect(screen.getByText("sync.conflictDescription")).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    renderDialog(false);
    expect(screen.queryByText("sync.conflictTitle")).not.toBeInTheDocument();
  });

  it("renders all action buttons", () => {
    renderDialog();
    expect(
      screen.getByRole("button", { name: "sync.uploadAnyway" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "sync.downloadCloud" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "games.cancel" }),
    ).toBeInTheDocument();
  });

  it("calls onUploadAnyway and closes when upload anyway is clicked", async () => {
    renderDialog();
    await user.click(screen.getByRole("button", { name: "sync.uploadAnyway" }));
    expect(onUploadAnyway).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onDownloadCloud and closes when download cloud is clicked", async () => {
    renderDialog();
    await user.click(
      screen.getByRole("button", { name: "sync.downloadCloud" }),
    );
    expect(onDownloadCloud).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
