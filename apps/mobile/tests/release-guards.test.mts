/// <reference types="node" />
/**
 * Source-level guards for dev-only code. The definitive check is
 * `npm run check:release` (builds the Android/iOS release bundles and greps
 * them); this fast test catches regressions that would pull dev modules in.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';

const SRC = new URL('../src/', import.meta.url).pathname;
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
const sources = files(SRC).map((p) => ({ path: relative(SRC, p), text: readFileSync(p, 'utf8') }));

const DEV_MODULES = ['@/dev/ScanSimulator', './dev-provider', '@/dev/fixtures', './fixture-repository'];
const GUARD = "process.env.NODE_ENV !== 'production'";

describe('dev-only modules stay out of release bundles', () => {
  it('are never imported statically (only required behind the NODE_ENV guard)', () => {
    for (const { path, text } of sources) {
      if (path.startsWith('dev/') || path.endsWith('dev-provider.ts') || path.endsWith('fixture-repository.ts')) continue;
      for (const mod of DEV_MODULES) {
        assert.ok(!new RegExp(`^import [^;]*from '${mod.replace(/[/.@]/g, '\\$&')}`, 'm').test(text), `${path} imports ${mod}`);
        if (text.includes(`require('${mod}`)) {
          const at = text.indexOf(`require('${mod}`);
          assert.ok(text.slice(Math.max(0, at - 400), at).includes(GUARD), `${path}: require('${mod}') is not behind ${GUARD}`);
        }
      }
    }
  });

  it('the scanner simulator is required only by the scan screen', () => {
    const users = sources.filter((s) => s.text.includes('@/dev/ScanSimulator')).map((s) => s.path);
    assert.deepEqual(users, ['app/guest/scan.tsx']);
  });

  it('simulator labels are not in the shipped translations', () => {
    for (const lang of ['fr', 'en', 'ar']) {
      const text = readFileSync(join(SRC, `i18n/locales/${lang}.ts`), 'utf8');
      assert.ok(!/devValid|devInactive|Simulation/.test(text), `${lang}.ts mentions the simulator`);
    }
  });
});
