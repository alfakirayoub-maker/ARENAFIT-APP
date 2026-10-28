const NNBSP = ' ';

/**
 * French typography: a narrow no-break space before ; : ! ? » and after «,
 * so punctuation never wraps onto its own line.
 */
export function typesetFrench(text: string): string {
  return text.replace(/\s+([;:!?»])/g, `${NNBSP}$1`).replace(/«\s+/g, `«${NNBSP}`);
}

/** Applies a string transform through a nested messages object, including function results. */
export function deepTypeset<T>(value: T, fix: (s: string) => string): T {
  if (typeof value === 'string') return fix(value) as T;
  if (typeof value === 'function') return ((...args: unknown[]) => deepTypeset((value as (...a: unknown[]) => unknown)(...args), fix)) as T;
  if (Array.isArray(value)) return value.map((v) => deepTypeset(v, fix)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepTypeset(v, fix)])) as T;
  return value;
}
