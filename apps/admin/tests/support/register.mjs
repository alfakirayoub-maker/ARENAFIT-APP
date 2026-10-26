// Lets Node's test runner load dashboard modules: resolves "@/…" and
// extensionless imports like the bundler does. Test-only.
import { register } from 'node:module';

register('./alias-hooks.mjs', import.meta.url);
