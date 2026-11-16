import type { EuclidResult } from './euclidModel';

/** The Extended Euclid step table: every row satisfies r = s·m + t·a. */
export function EuclidTable({ result, caption }: { result: EuclidResult; caption?: string }) {
  return (
    <div className="euclid-table-wrap">
      <table className="euclid-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">q</th>
            <th scope="col">r</th>
            <th scope="col">s (× m)</th>
            <th scope="col">t (× a)</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => (
            <tr key={row.step} className={row.r === 1n ? 'euclid-hit' : undefined}>
              <td>{row.step}</td>
              <td>{row.q === null ? '—' : String(row.q)}</td>
              <td>{String(row.r)}</td>
              <td>{String(row.s)}</td>
              <td>{String(row.t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.truncated && (
        <p className="helper-text">
          Showing the first {result.rows.length - 2} of {result.stepCount} division steps; the
          result below uses all of them.
        </p>
      )}
    </div>
  );
}
