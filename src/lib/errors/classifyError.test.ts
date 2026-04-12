import { describe, it, expect } from "vitest";
import { classifyError } from "./classifyError";

describe("classifyError", () => {
  describe("quota exceeded", () => {
    it("detects storageQuotaExceeded in Google Drive JSON body", () => {
      const raw =
        'Failed to upload file "Game.zip": Failed to initiate upload: 403 Forbidden {"error":{"errors":[{"reason":"storageQuotaExceeded"}]}}';
      expect(classifyError(raw)).toBe("errors.quotaExceeded");
    });

    it("detects quotaExceeded keyword", () => {
      const raw = "403 Forbidden quotaExceeded";
      expect(classifyError(raw)).toBe("errors.quotaExceeded");
    });

    it("prioritizes quota over generic 403", () => {
      const raw = "403 Forbidden storageQuota limit reached";
      expect(classifyError(raw)).toBe("errors.quotaExceeded");
    });
  });

  describe("auth expired", () => {
    it("detects 401 from assertOk format", () => {
      const raw =
        'Failed to list files: 401 Unauthorized {"error":"invalid_token"}';
      expect(classifyError(raw)).toBe("errors.authExpired");
    });

    it("detects 401 from Rust HTTP format", () => {
      const raw = "Download failed: HTTP 401 unauthorized";
      expect(classifyError(raw)).toBe("errors.authExpired");
    });
  });

  describe("forbidden (non-quota)", () => {
    it("detects 403 without quota keywords", () => {
      const raw = "Failed to create folder: 403 Forbidden";
      expect(classifyError(raw)).toBe("errors.forbidden");
    });
  });

  describe("not found", () => {
    it("detects 404 from assertOk", () => {
      const raw = 'Failed to delete file "abc123": 404 Not Found';
      expect(classifyError(raw)).toBe("errors.notFound");
    });

    it("detects 404 from Rust download", () => {
      const raw = "Download failed: HTTP 404 Not Found";
      expect(classifyError(raw)).toBe("errors.notFound");
    });
  });

  describe("rate limited", () => {
    it("detects 429 Too Many Requests", () => {
      const raw = "Failed to list files: 429 Too Many Requests";
      expect(classifyError(raw)).toBe("errors.rateLimited");
    });
  });

  describe("server error", () => {
    it("detects 500 Internal Server Error", () => {
      const raw = "Failed to upload: 500 Internal Server Error";
      expect(classifyError(raw)).toBe("errors.serverError");
    });

    it("detects 502 Bad Gateway", () => {
      const raw = "Upload failed: 502 Bad Gateway";
      expect(classifyError(raw)).toBe("errors.serverError");
    });

    it("detects 503 Service Unavailable", () => {
      const raw = "Download failed: HTTP 503 Service Unavailable";
      expect(classifyError(raw)).toBe("errors.serverError");
    });
  });

  describe("network error", () => {
    it("detects connection reset after retries", () => {
      const raw = "Upload failed after 5 retries: connection reset";
      expect(classifyError(raw)).toBe("errors.networkError");
    });

    it("detects timeout", () => {
      const raw = "Request failed: timed out";
      expect(classifyError(raw)).toBe("errors.networkError");
    });

    it("detects connection refused", () => {
      const raw = "Request failed: connection refused";
      expect(classifyError(raw)).toBe("errors.networkError");
    });

    it("detects failed to stream body", () => {
      const raw = "Failed to stream body to disk: broken pipe";
      expect(classifyError(raw)).toBe("errors.networkError");
    });
  });

  describe("fallback", () => {
    it("returns unknown for unrecognized errors", () => {
      expect(classifyError("something unexpected happened")).toBe(
        "errors.unknown",
      );
    });

    it("returns unknown for empty string", () => {
      expect(classifyError("")).toBe("errors.unknown");
    });

    it("returns unknown when message contains an out-of-range status code", () => {
      expect(classifyError("error 600 something")).toBe("errors.unknown");
    });
  });
});
