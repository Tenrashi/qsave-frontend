import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, setupUser } from "@/test/test-utils";
import { SearchBar, type SearchBarProps } from "./SearchBar";

const defaultProps: SearchBarProps = {
  value: "",
  onChange: vi.fn(),
};

const renderSearchBar = (overrides: Partial<SearchBarProps> = {}) => {
  return renderWithProviders(<SearchBar {...defaultProps} {...overrides} />);
};

describe("SearchBar", () => {
  it("renders with placeholder", () => {
    renderSearchBar();
    expect(
      screen.getByPlaceholderText("search.placeholder"),
    ).toBeInTheDocument();
  });

  it("displays the current value", () => {
    renderSearchBar({ value: "Sims" });
    expect(screen.getByDisplayValue("Sims")).toBeInTheDocument();
  });

  it("calls onChange when typing", async () => {
    const onChange = vi.fn();
    const user = setupUser();
    renderSearchBar({ onChange });

    await user.type(screen.getByPlaceholderText("search.placeholder"), "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });
});
