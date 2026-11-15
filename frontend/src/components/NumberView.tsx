import { useState } from 'react';
import { i2osp, bitLength } from '../engine/math';
import { Value } from './Value';

export function NumberView({
  label,
  value,
  privateValue = false,
}: {
  label: string;
  value: bigint;
  privateValue?: boolean;
}) {
  const [format, setFormat] = useState<'dec' | 'hex' | 'base64'>('dec');
  const [revealed, setRevealed] = useState(false);
  if (privateValue && !revealed)
    return (
      <div className="number-view">
        <span>{label} · private</span>
        <button className="secondary-button" onClick={() => setRevealed(true)}>
          Reveal value
        </button>
      </div>
    );
  let encoded = String(value);
  if (format === 'hex') encoded = `0x${value.toString(16)}`;
  if (format === 'base64') {
    if (value < 0n) encoded = 'Base64 requires an unsigned integer';
    else {
      const bytes = i2osp(value, Math.max(1, Math.ceil(bitLength(value) / 8)));
      encoded = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
    }
  }
  return (
    <div className="number-view">
      <div className="segmented" aria-label={`${label} representation`}>
        {(['dec', 'hex', 'base64'] as const).map((f) => (
          <button
            key={f}
            aria-pressed={format === f}
            className={format === f ? 'selected' : ''}
            onClick={() => setFormat(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <Value label={label} value={encoded} privateValue={privateValue} />
      {privateValue && (
        <button className="text-button" onClick={() => setRevealed(false)}>
          Hide private value
        </button>
      )}
    </div>
  );
}
