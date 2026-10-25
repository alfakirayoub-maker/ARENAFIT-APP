// Lets Node's test runner load app modules: resolves the "@/…" path alias and
// extensionless relative imports the way Metro/TypeScript do. Test-only.
import { register } from 'node:module';

register('./alias-hooks.mjs', import.meta.url);
