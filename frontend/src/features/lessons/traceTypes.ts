export type TraceValue = { label: string; value: string };
export type TraceFrame = {
  sourceIndex?: number;
  title: string;
  detail: string;
  inputs: TraceValue[];
  operation: string;
  output: TraceValue;
  equation?: string;
  reduction?: { product: bigint; modulus: bigint };
};
export const datum = (label: string, value: bigint | number | string): TraceValue => ({
  label,
  value: String(value),
});
export const frame = (
  title: string,
  detail: string,
  inputs: TraceValue[],
  operation: string,
  output: TraceValue,
  equation?: string,
): TraceFrame => ({ title, detail, inputs, operation, output, equation });
