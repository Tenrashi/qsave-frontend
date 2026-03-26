import { MIME_TYPES } from "@/lib/constants/constants";

export const buildMultipartBody = (
  boundary: string,
  metadata: string,
  fileContent: Uint8Array,
): Uint8Array => {
  const encoder = new TextEncoder();
  const metadataPart = encoder.encode(
    `--${boundary}\r\nContent-Type: ${MIME_TYPES.jsonUtf8}\r\n\r\n${metadata}\r\n`,
  );
  const filePart = encoder.encode(
    `--${boundary}\r\nContent-Type: ${MIME_TYPES.octetStream}\r\n\r\n`,
  );
  const end = encoder.encode(`\r\n--${boundary}--`);

  const result = new Uint8Array(
    metadataPart.length + filePart.length + fileContent.length + end.length,
  );
  let offset = 0;
  result.set(metadataPart, offset);
  offset += metadataPart.length;
  result.set(filePart, offset);
  offset += filePart.length;
  result.set(fileContent, offset);
  offset += fileContent.length;
  result.set(end, offset);

  return result;
};
