import { parseBcbp } from './bcbp';

// Boarding-pass barcode text from a photo/screenshot. Native BarcodeDetector (Android Chrome) first when
// it supports PDF417; if it finds nothing usable, the zxing-wasm ponyfill (also the only path on iOS,
// desktop), loaded only when someone scans. Native misses some codes zxing reads (e.g. IndiGo QR passes).
export async function readBoardingPassBarcode(file: File): Promise<string | null> {
  const formats: ('pdf417' | 'aztec' | 'qr_code' | 'data_matrix')[] = ['pdf417', 'aztec', 'qr_code', 'data_matrix'];
  type Detector = typeof import('barcode-detector/ponyfill').BarcodeDetector;
  const pick = (codes: { rawValue: string }[]) => codes.find((c) => parseBcbp(c.rawValue))?.rawValue ?? null;
  const image = await createImageBitmap(file);

  const Native = (globalThis as { BarcodeDetector?: Detector }).BarcodeDetector;
  const supported = Native ? await Native.getSupportedFormats().catch(() => []) : [];
  if (Native && supported.includes('pdf417')) {
    const nativeFormats = formats.filter((f) => supported.includes(f));
    const hit = await new Native({ formats: nativeFormats }).detect(image).then(pick).catch(() => null);
    if (hit) return hit;
  }
  const { BarcodeDetector } = await import('barcode-detector/ponyfill');
  return pick(await new BarcodeDetector({ formats }).detect(image));
}
