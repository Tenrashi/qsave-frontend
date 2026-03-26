import { describe, it, expect } from "vitest";
import { buildMultipartBody } from "./multipart";

describe("buildMultipartBody", () => {
  const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

  it("wraps metadata and file content with boundary markers", () => {
    const metadata = JSON.stringify({ name: "test.zip" });
    const content = new TextEncoder().encode("file-data");
    const result = decode(
      buildMultipartBody("test_boundary", metadata, content),
    );

    expect(result).toContain("--test_boundary\r\n");
    expect(result).toContain(metadata);
    expect(result).toContain("file-data");
    expect(result.endsWith("\r\n--test_boundary--")).toBe(true);
  });
});
