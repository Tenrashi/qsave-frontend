import { describe, it, expect } from "vitest";
import { renderWithProviders, screen, setupUser } from "@/test/test-utils";
import { LanguageSelector } from "./LanguageSelector";

describe("LanguageSelector", () => {
  it("renders the language button", () => {
    renderWithProviders(<LanguageSelector />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("shows language options on click", async () => {
    const user = setupUser();
    renderWithProviders(<LanguageSelector />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Français")).toBeInTheDocument();
    expect(screen.getByText("Español")).toBeInTheDocument();
  });
});
