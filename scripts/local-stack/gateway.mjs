// LOCAL TESTING ONLY — stand-in for the Supabase API gateway:
//   /rest/v1/* → PostgREST (:3000)   /auth/v1/* → GoTrue (:9999)
// Requires an apikey (anon or service) like Supabase does, and forwards the
// client address as x-forwarded-for (used by short-code rate limiting).
// Usage: node gateway.mjs <state-dir>      (kill -USR2 <pid> toggles 503 failure mode)
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const state = process.argv[2] ?? '.local-stack';
const ANON = readFileSync(join(state, 'anon-key'), 'utf8').trim();
const SERVICE = readFileSync(join(state, 'service-key'), 'utf8').trim();
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, apikey, content-type, x-client-info, x-supabase-api-version, accept-profile, content-profile, prefer, range, accept',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-expose-headers': 'content-range',
};
let failing = false;

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }
    if (failing) {
      res.writeHead(503, cors);
      return res.end('{"message":"unavailable"}');
    }
    const url = new URL(req.url, 'http://x');
    const target = url.pathname.startsWith('/rest/v1/')
      ? { port: 3000, prefix: '/rest/v1' }
      : url.pathname.startsWith('/auth/v1/')
        ? { port: 9999, prefix: '/auth/v1' }
        : null;
    if (!target) {
      res.writeHead(404, cors);
      return res.end();
    }
    const key = req.headers.apikey ?? url.searchParams.get('apikey');
    if (key !== ANON && key !== SERVICE) {
      res.writeHead(401, { ...cors, 'content-type': 'application/json' });
      return res.end('{"message":"Invalid API key"}');
    }
    const headers = { ...req.headers, host: `127.0.0.1:${target.port}`, 'x-forwarded-for': req.socket.remoteAddress };
    if (target.port === 3000) delete headers.apikey;
    const up = http.request(
      { host: '127.0.0.1', port: target.port, method: req.method, path: url.pathname.slice(target.prefix.length) + url.search, headers },
      (r) => {
        res.writeHead(r.statusCode, { ...r.headers, ...cors });
        r.pipe(res);
      },
    );
    up.on('error', () => {
      res.writeHead(502, cors);
      res.end();
    });
    req.pipe(up);
  })
  .listen(54321, () => console.log('gateway on :54321'));

process.on('SIGUSR2', () => {
  failing = !failing;
  console.log('failing =', failing);
});
