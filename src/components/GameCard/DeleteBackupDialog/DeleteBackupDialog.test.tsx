import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, setupUser } from "@/test/test-utils";
import { DeleteBackupDialog } from "./DeleteBackupDialog";
import { Button } from "@/components/ui/button";

vi.mock("./DeleteBackupContent/DeleteBackupContent", () => ({
  DeleteBackupContent: ({ onConfirm }: { onConfirm: () => void }) => (
    <div data-testid="delete-backup-content">
      <button onClick={onConfirm}>Confirm</button>
    </div>
  ),
}));

const renderDialog = (onConfirm = vi.fn()) => {
  renderWithProviders(
    <DeleteBackupDialog
      onConfirm={onConfirm}
      trigger={<Button>Delete</Button>}
    />,
  );
  return { onConfirm };
};

describe("DeleteBackupDialog", () => {
  const user = setupUser();

  it("does not show content initially", () => {
    renderDialog();
    expect(
      screen.queryByTestId("delete-backup-content"),
    ).not.toBeInTheDocument();
  });

  it("shows content when trigger is clicked", async () => {
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByTestId("delete-backup-content")).toBeInTheDocument();
  });

  it("calls onConfirm and closes dialog on confirm", async () => {
    const { onConfirm } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(
      screen.queryByTestId("delete-backup-content"),
    ).not.toBeInTheDocument();
  });
});
