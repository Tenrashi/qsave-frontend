import { describe, it, expect } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { ConflictWarning } from "./ConflictWarning";

describe("ConflictWarning", () => {
  it("renders warning message", () => {
    renderWithProviders(<ConflictWarning />);
    expect(screen.getByText("restore.conflictWarning")).toBeInTheDocument();
  });
});
