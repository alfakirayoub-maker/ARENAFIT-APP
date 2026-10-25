// LOCAL TESTING ONLY — signs a long-lived API key (anon / service_role) with the local JWT secret.
// Usage: node mint-jwt.mjs <state-dir> <role>
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [state, role] = process.argv.slice(2);
const secret = readFileSync(join(state, 'jwt-secret'), 'utf8').trim();
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role, iss: 'supabase-local', iat: now, exp: now + 10 * 365 * 86400 })}`;
console.log(`${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`);
