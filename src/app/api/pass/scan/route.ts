import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { readBarcodes } from 'zxing-wasm/reader';
import { getSessionUserId } from '@/lib/server/session';
import { parseBcbp } from '@/lib/bcbp';

// Fallback boarding-pass barcode reader for images the browser cannot decode (truncated/odd JPEGs that
// phone galleries still show). sharp decodes leniently; zxing reads the barcode. Image is not stored.
export async function POST(request: NextRequest) {
  if (!(await getSessionUserId())) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const file = (await request.formData()).get('file');
  if (!(file instanceof Blob) || file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image required (max 15 MB)' }, { status: 400 });
  }
  try {
    const { data, info } = await sharp(Buffer.from(await file.arrayBuffer()), { failOn: 'none' })
      .rotate() // honour EXIF orientation of camera photos
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const codes = await readBarcodes(
      { data: new Uint8ClampedArray(data), width: info.width, height: info.height, colorSpace: 'srgb' },
      { formats: ['PDF417', 'Aztec', 'QRCode', 'DataMatrix'], tryHarder: true },
    );
    const raw = codes.find((c) => parseBcbp(c.text))?.text ?? null;
    return NextResponse.json({ raw });
  } catch {
    return NextResponse.json({ error: 'Could not decode image' }, { status: 422 });
  }
}
