import { describe, it, expect } from "vitest";
import { enUS, fr } from "date-fns/locale";
import { dateFnsLocales } from "./date-locales";

describe("dateFnsLocales", () => {
  it("maps 'en' to enUS locale", () => {
    expect(dateFnsLocales.en).toBe(enUS);
  });

  it("maps 'fr' to French locale", () => {
    expect(dateFnsLocales.fr).toBe(fr);
  });

  it("includes all supported locales", () => {
    const expected = ["en", "fr", "es", "de", "ja", "zh", "pt", "ko", "ru", "it"];
    for (const key of expected) {
      expect(dateFnsLocales[key]).toBeDefined();
    }
  });

  it("returns undefined for unsupported locales", () => {
    expect(dateFnsLocales["xx"]).toBeUndefined();
  });
});
