import { parseBcbp } from './bcbp';

// Boarding-pass barcode text from a photo/screenshot. In the browser first: native BarcodeDetector
// (Android Chrome) when it supports PDF417, then the zxing-wasm ponyfill (also the only path on iOS,
// desktop), loaded only when someone scans. If the browser can't decode the image (some phone JPEGs make
// createImageBitmap throw "The source image could not be decoded") or finds nothing, the server retries.
async function readInBrowser(file: File): Promise<string | null> {
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
  const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
  // Serve the decoder from our own origin instead of the default jsDelivr CDN fetch.
  // ponytail: public/zxing_reader.wasm is a copy from node_modules/zxing-wasm/dist/reader — recopy on upgrade.
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? '/zxing_reader.wasm' : prefix + path) },
  });
  return pick(await new BarcodeDetector({ formats }).detect(image));
}

export async function readBoardingPassBarcode(file: File): Promise<string | null> {
  const local = await readInBrowser(file).catch(() => null);
  if (local) return local;
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/pass/scan', { method: 'POST', body });
  if (!res.ok) throw new Error(`scan failed: ${res.status}`);
  return ((await res.json()) as { raw: string | null }).raw;
}
