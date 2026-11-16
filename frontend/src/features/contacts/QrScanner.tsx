import { useEffect, useRef, useState } from 'react';
import { drawQrFrame, readQr } from './qr';

export function QrScanner({ onRead }: { onRead: (value: string) => void }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onRead);
  useEffect(() => {
    callback.current = onRead;
  }, [onRead]);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            'Camera unavailable. Use HTTPS, or upload a QR image / .pub file instead.',
          );
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const target = video.current;
        if (!target) return;
        target.srcObject = stream;
        await target.play();
        async function scan() {
          if (stopped || !target) return;
          try {
            if (target.readyState >= 2 && target.videoWidth > 0) {
              const value = await readQr(
                drawQrFrame(target, target.videoWidth, target.videoHeight),
              );
              if (!stopped && value) {
                callback.current(value);
                setActive(false);
                return;
              }
            }
            if (!stopped) timer = setTimeout(() => void scan(), 350);
          } catch (e) {
            if (!stopped) {
              setError((e as Error).message);
              setActive(false);
            }
          }
        }
        if (!stopped) void scan();
      } catch (e) {
        if (!stopped) {
          setError(
            (e as Error).name === 'NotAllowedError'
              ? 'Camera permission denied. Allow camera access in your browser settings, or upload a QR image / .pub file.'
              : (e as Error).message,
          );
          setActive(false);
        }
      }
    }
    void start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active]);

  return (
    <div className="qr-scanner">
      <button
        className="secondary-button"
        onClick={() => {
          setError('');
          setActive((value) => !value);
        }}
      >
        {active ? 'Stop camera' : 'Scan public-key QR'}
      </button>
      {active && (
        <>
          <video ref={video} muted playsInline aria-label="Public-key scanner camera" />
          <p role="status">Point the camera at a public-key QR. Nothing is uploaded.</p>
        </>
      )}
      <label>
        Or upload a QR image
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            setError('');
            let image: ImageBitmap | undefined;
            try {
              if (file.size > 10 * 1024 * 1024)
                throw new Error('Choose a QR image of at most 10 MiB.');
              image = await createImageBitmap(file);
              if (image.width * image.height > 16000000)
                throw new Error('QR images must be at most 16 megapixels.');
              const value = await readQr(drawQrFrame(image, image.width, image.height));
              if (!value)
                throw new Error('No QR code found. Try a sharper image or paste the .pub key.');
              setActive(false);
              callback.current(value);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              image?.close();
            }
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <p className="helper-text">
        Uses your browser’s BarcodeDetector when available, with a bundled scanner fallback.
        Scanning a key does not verify its owner.
      </p>
    </div>
  );
}
