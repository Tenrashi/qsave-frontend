import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import { RemoveGameDialog } from "./RemoveGameDialog";
import { Button } from "@/components/ui/button";

const renderDialog = (onConfirm = vi.fn()) =>
  renderWithProviders(
    <RemoveGameDialog
      onConfirm={onConfirm}
      trigger={<Button>Delete</Button>}
    />,
  );

describe("RemoveGameDialog", () => {
  it("does not show dialog initially", () => {
    renderDialog();
    expect(screen.queryByText("games.removeConfirmTitle")).not.toBeInTheDocument();
  });

  it("opens dialog when trigger is clicked", async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("games.removeConfirmTitle")).toBeInTheDocument();
    expect(screen.getByText("games.removeConfirmDescription")).toBeInTheDocument();
  });

  it("calls onConfirm and closes when remove button is clicked", async () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "games.remove" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("does not call onConfirm when cancel is clicked", async () => {
    const onConfirm = vi.fn();
    renderDialog(onConfirm);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "games.cancel" }));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
