import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function Orientation({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = ref.current?.querySelectorAll<HTMLElement>('button,a[href]');
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="orientation-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="icon-button close-modal"
          aria-label="Close orientation"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <h2 id="orientation-title">Welcome to RSA Lab</h2>
        <p>
          Start with the worked example. Learn and Break pages marked “planned” will arrive as their
          issues are implemented.
        </p>
        <p>
          Key generation, encryption and the experiments run in your browser. No local server or
          account is required.
        </p>
        <p>
          Use demonstration data. The custom engine is educational, not audited or constant-time.
          Keys stay in this tab’s memory; refreshing clears them. 1024-bit RSA is included for the
          assignment.
        </p>
        <button className="primary-button" onClick={onClose}>
          Continue exploring
        </button>
      </div>
    </div>
  );
}
