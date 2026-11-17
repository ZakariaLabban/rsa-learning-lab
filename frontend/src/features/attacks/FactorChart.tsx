import { LessonTable } from '../number-theory/LessonParts';

export type FactorMeasurement = {
  id: number;
  bits: number;
  elapsedMs: number;
  attempts: number;
  status: 'factored' | 'timeout' | 'exhausted';
};
export function FactorChart({ points }: { points: FactorMeasurement[] }) {
  if (!points.length)
    return <p>Run a few tiny-key sizes to plot measurements from this browser.</p>;
  const top = Math.max(1, ...points.map((point) => point.elapsedMs));
  const x = (bits: number) => 65 + ((bits - 16) / 36) * 490;
  const y = (elapsed: number) => 205 - (elapsed / top) * 160;
  return (
    <>
      <figure className="factor-chart">
        <svg
          viewBox="0 0 600 260"
          role="img"
          aria-label="Measured trial division time versus tiny RSA key size"
        >
          <title>Trial division measurements from this browser session</title>
          <line x1="65" y1="205" x2="565" y2="205" />
          <line x1="65" y1="35" x2="65" y2="205" />
          {[0, 0.5, 1].map((fraction) => (
            <g key={fraction}>
              <text x="55" y={y(top * fraction) + 4} textAnchor="end">
                {(top * fraction).toFixed(1)}
              </text>
              <line
                className="chart-grid"
                x1="65"
                y1={y(top * fraction)}
                x2="565"
                y2={y(top * fraction)}
              />
            </g>
          ))}
          {[16, 24, 32, 40, 48, 52].map((bits) => (
            <text x={x(bits)} y="225" textAnchor="middle" key={bits}>
              {bits}
            </text>
          ))}
          <text x="300" y="250" textAnchor="middle">
            Modulus size (bits)
          </text>
          <text x="10" y="20">
            Time (ms)
          </text>
          {points.map((point) =>
            point.status === 'timeout' ? (
              <path
                className="chart-timeout"
                key={point.id}
                d={`M ${x(point.bits)} ${y(point.elapsedMs) - 6} l -6 12 h 12 z`}
              >
                <title>
                  {point.bits}-bit timeout after {point.elapsedMs.toFixed(2)} ms; completion time
                  unknown
                </title>
              </path>
            ) : (
              <circle key={point.id} cx={x(point.bits)} cy={y(point.elapsedMs)} r="5">
                <title>
                  {point.bits}-bit {point.status}: {point.elapsedMs.toFixed(2)} ms
                </title>
              </circle>
            ),
          )}
        </svg>
        <figcaption>
          Circles: finished searches. Triangles: timeouts, not completed factorization times.
          Measurements are local observations, not guarantees for other devices.
        </figcaption>
      </figure>
      <LessonTable caption="Measured tiny-key trial-division runs">
        <thead>
          <tr>
            {['Bits', 'Search ms', 'Odd divisions', 'Outcome'].map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.id}>
              <td>{point.bits}</td>
              <td>{point.elapsedMs.toFixed(3)}</td>
              <td>{point.attempts.toLocaleString()}</td>
              <td>{point.status}</td>
            </tr>
          ))}
        </tbody>
      </LessonTable>
    </>
  );
}
