/** Bound JPEG storage and decoded dimensions; uploaded bytes are never executed. */
export function validateJpegBytes(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes.length > 4_000_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) throw new Error("Upload a JPEG smaller than 4 MB.");
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 0xff) throw new Error("Invalid JPEG header.");
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) throw new Error("Invalid JPEG segment.");
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      if (length < 8) throw new Error("Invalid JPEG frame.");
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4], width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      if (!width || !height || width > 2000 || height > 2000) throw new Error("Prepare a photo with a maximum edge of 2000 pixels.");
      return { width, height };
    }
    offset += length;
  }
  throw new Error("JPEG dimensions could not be read.");
}
