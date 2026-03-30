import { describe, it, expect } from "vitest";
import { generateCodeVerifier, generateCodeChallenge } from "./pkce";

describe("pkce", () => {
  describe("generateCodeVerifier", () => {
    it("returns a URL-safe base64 string", () => {
      const verifier = generateCodeVerifier();

      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(verifier.length).toBeGreaterThanOrEqual(43);
    });

    it("generates unique values", () => {
      const first = generateCodeVerifier();
      const second = generateCodeVerifier();

      expect(first).not.toBe(second);
    });
  });

  describe("generateCodeChallenge", () => {
    it("returns a URL-safe base64 string", async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);

      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("produces a different value than the verifier", async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);

      expect(challenge).not.toBe(verifier);
    });

    it("is deterministic for the same verifier", async () => {
      const verifier = "test-verifier-value";
      const first = await generateCodeChallenge(verifier);
      const second = await generateCodeChallenge(verifier);

      expect(first).toBe(second);
    });
  });
});
