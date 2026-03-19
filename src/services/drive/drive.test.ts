import { describe, it, expect } from "vitest";
import { buildMultipartBody } from "./drive";

describe("buildMultipartBody", () => {
  const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

  it("wraps metadata and file content with boundary markers", () => {
    const metadata = JSON.stringify({ name: "test.zip" });
    const content = new TextEncoder().encode("file-data");
    const boundary = "test_boundary";

    const result = decode(buildMultipartBody(boundary, metadata, content));

    expect(result).toContain(`--${boundary}\r\n`);
    expect(result).toContain("Content-Type: application/json");
    expect(result).toContain(metadata);
    expect(result).toContain("Content-Type: application/octet-stream");
    expect(result).toContain("file-data");
    expect(result.endsWith(`\r\n--${boundary}--`)).toBe(true);
  });

  it("preserves binary file content exactly", () => {
    const content = new Uint8Array([0, 1, 2, 255, 254, 253]);
    const result = buildMultipartBody("b", "{}", content);

    const bodyStr = decode(result);
    const filePartHeader = "Content-Type: application/octet-stream\r\n\r\n";
    const fileStart = bodyStr.indexOf(filePartHeader) + filePartHeader.length;
    const fileEnd = bodyStr.lastIndexOf("\r\n--b--");

    const extracted = result.slice(fileStart, fileEnd);
    expect(Array.from(extracted)).toEqual(Array.from(content));
  });

  it("handles empty file content", () => {
    const result = decode(buildMultipartBody("b", "{}", new Uint8Array(0)));

    expect(result).toContain("Content-Type: application/octet-stream\r\n\r\n\r\n--b--");
  });

  it("total length equals sum of all parts", () => {
    const metadata = '{"name":"a.zip"}';
    const content = new Uint8Array(100);
    const boundary = "boundary123";

    const result = buildMultipartBody(boundary, metadata, content);

    const encoder = new TextEncoder();
    const metaPartLen = encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    ).length;
    const filePartLen = encoder.encode(
      `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    ).length;
    const endLen = encoder.encode(`\r\n--${boundary}--`).length;

    expect(result.length).toBe(metaPartLen + filePartLen + content.length + endLen);
  });
});
