import { statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = new URL('../../src/', import.meta.url);
const CANDIDATES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

const isFile = (path) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

/** First existing file for an extensionless module URL, as Metro would resolve it. */
function resolveFile(url) {
  const base = fileURLToPath(url);
  for (const suffix of CANDIDATES) {
    if (isFile(base + suffix)) return pathToFileURL(base + suffix).href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const hit = resolveFile(new URL(specifier.slice(2), SRC));
    if (hit) return { url: hit, shortCircuit: true };
  } else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const hit = resolveFile(new URL(specifier, context.parentURL));
    if (hit) return { url: hit, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
