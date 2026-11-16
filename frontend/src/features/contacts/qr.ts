/** All QR contents stay local. A QR is public-key transport, not identity verification. */
type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

export async function readQr(canvas: HTMLCanvasElement): Promise<string | null> {
  const Native = (globalThis as typeof globalThis & { BarcodeDetector?: DetectorConstructor })
    .BarcodeDetector;
  if (Native) {
    try {
      const values = await new Native({ formats: ['qr_code'] }).detect(canvas);
      if (values[0]?.rawValue) return values[0].rawValue;
    } catch {
      /* Unsupported implementations also use the bundled fallback. */
    }
  }
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context)
    throw new Error('This browser cannot read camera images. Paste or upload a .pub key instead.');
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const { default: jsQR } = await import('jsqr');
  return jsQR(pixels.data, pixels.width, pixels.height)?.data ?? null;
}

export function drawQrFrame(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const scale = Math.min(1, 1200 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('Image reading is unavailable. Paste or upload a .pub key instead.');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
