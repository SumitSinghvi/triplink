import { parseBcbp } from './bcbp';

// Boarding-pass barcode text from a photo/screenshot. Native BarcodeDetector (Android Chrome) when it
// supports PDF417, else the zxing-wasm ponyfill (iOS, desktop), loaded only when someone scans.
export async function readBoardingPassBarcode(file: File): Promise<string | null> {
  const formats: ('pdf417' | 'aztec' | 'qr_code' | 'data_matrix')[] = ['pdf417', 'aztec', 'qr_code', 'data_matrix'];
  type Detector = typeof import('barcode-detector/ponyfill').BarcodeDetector;
  const Native = (globalThis as { BarcodeDetector?: Detector }).BarcodeDetector;
  const Impl: Detector =
    Native && (await Native.getSupportedFormats()).includes('pdf417')
      ? Native
      : (await import('barcode-detector/ponyfill')).BarcodeDetector;
  const codes = await new Impl({ formats }).detect(await createImageBitmap(file));
  return codes.find((c) => parseBcbp(c.rawValue))?.rawValue ?? null;
}
