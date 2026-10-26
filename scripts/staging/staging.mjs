#!/usr/bin/env node
/**
 * Arena Fit — STAGING presentation environment (docs/STAGING.md).
 *
 *   node scripts/staging/staging.mjs init                 create .env.staging (git-ignored) with generated passwords
 *   node scripts/staging/staging.mjs check                verify configuration, guards and what the project contains
 *   node scripts/staging/staging.mjs mark-staging --confirm <project-ref>
 *                                                         one-time: mark the database as the staging project
 *   node scripts/staging/staging.mjs reset                restore the presentation dataset, demo accounts and
 *                                                         Guest Pass examples (before every meeting)
 *
 * Options: --config <path> (default .env.staging at the repository root).
 *
 * Safety — every command that writes refuses unless ALL hold:
 *   1. STAGING_SUPABASE_URL is https://<STAGING_PROJECT_REF>.supabase.co
 *      (or localhost, for a local rehearsal against scripts/local-stack),
 *   2. STAGING_DB_URL points at that same project,
 *   3. the project ref differs from PRODUCTION_PROJECT_REF (when set),
 *   4. the database carries the staging marker written by `mark-staging`
 *      (checked again inside the SQL itself).
 *
 * The service-role key and the database URL stay on the operator's machine.
 * SQL runs through the Supabase CLI (`supabase db query`), fetched with npx.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SUPABASE_CLI = 'supabase@2.122.0';
const args = process.argv.slice(2);
const command = args[0] ?? 'help';
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const envFile = resolve(flag('--config') ?? join(ROOT, '.env.staging'));

const ACCOUNTS = [
  // key, role (staff) or kind (member), display name — what stakeholders see in the apps.
  { key: 'ADMIN', staffRole: 'admin', displayName: 'Direction' },
  { key: 'CONTENT', staffRole: 'content_manager', displayName: 'Équipe contenu' },
  { key: 'RECEPTION', staffRole: 'reception', displayName: 'Accueil' },
  { key: 'MEMBER', member: true },
  { key: 'INVITER', member: true },
];

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
const step = (msg) => console.log(`▸ ${msg}`);

// --- configuration ------------------------------------------------------------

/** A legacy service_role JWT or a new sb_secret_ key. */
function isServerKey(value) {
  if (value.startsWith('sb_secret_')) return true;
  try {
    return JSON.parse(Buffer.from(value.split('.')[1] ?? '', 'base64url').toString('utf8')).role === 'service_role';
  } catch {
    return false;
  }
}

function loadEnv() {
  if (!existsSync(envFile)) fail(`${envFile} not found. Run: node scripts/staging/staging.mjs init`);
  const env = {};
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  const required = ['STAGING_PROJECT_REF', 'STAGING_SUPABASE_URL', 'STAGING_ANON_KEY', 'STAGING_SERVICE_ROLE_KEY', 'STAGING_DB_URL'];
  for (const a of ACCOUNTS) required.push(`DEMO_${a.key}_EMAIL`, `DEMO_${a.key}_PASSWORD`);
  required.push('DEMO_MEMBER_FIRST_NAME', 'DEMO_MEMBER_LAST_NAME', 'DEMO_INVITER_FIRST_NAME', 'DEMO_INVITER_LAST_NAME');
  const missing = required.filter((k) => !env[k]);
  if (missing.length) fail(`${envFile}: missing ${missing.join(', ')}`);
  if (isServerKey(env.STAGING_ANON_KEY)) fail('STAGING_ANON_KEY is a server key — use the anon (publishable) key');
  if (!isServerKey(env.STAGING_SERVICE_ROLE_KEY)) fail('STAGING_SERVICE_ROLE_KEY is not a service_role / secret key');
  for (const a of ACCOUNTS) {
    if (!/^[^\s@']+@[^\s@']+\.[^\s@']+$/.test(env[`DEMO_${a.key}_EMAIL`])) fail(`DEMO_${a.key}_EMAIL is not a valid email`);
    if (env[`DEMO_${a.key}_PASSWORD`].length < 12) fail(`DEMO_${a.key}_PASSWORD must have at least 12 characters`);
  }
  return env;
}

/** Guards 1–3 (configuration). Returns true for a local rehearsal. */
function checkTarget(env) {
  const ref = env.STAGING_PROJECT_REF;
  const url = new URL(env.STAGING_SUPABASE_URL);
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (local) {
    if (!/@(localhost|127\.0\.0\.1)[:/]/.test(env.STAGING_DB_URL)) fail('local rehearsal: STAGING_DB_URL must be local too');
    return true;
  }
  if (!/^[a-z0-9]{20}$/.test(ref)) fail(`STAGING_PROJECT_REF "${ref}" doesn't look like a Supabase project ref`);
  if (url.protocol !== 'https:' || url.hostname !== `${ref}.supabase.co`) {
    fail(`STAGING_SUPABASE_URL must be https://${ref}.supabase.co (got ${env.STAGING_SUPABASE_URL})`);
  }
  if (!env.STAGING_DB_URL.includes(ref)) fail('STAGING_DB_URL does not point at the staging project (its ref is not in the URL)');
  if (env.PRODUCTION_PROJECT_REF && env.PRODUCTION_PROJECT_REF === ref) fail('STAGING_PROJECT_REF equals PRODUCTION_PROJECT_REF — refusing');
  if (env.PRODUCTION_PROJECT_REF && env.STAGING_DB_URL.includes(env.PRODUCTION_PROJECT_REF)) fail('STAGING_DB_URL mentions the production project — refusing');
  return false;
}

// --- Supabase access ---------------------------------------------------------

/** Runs one SQL statement through the Supabase CLI; returns parsed rows. */
function sql(env, statement) {
  const dir = mkdtempSync(join(tmpdir(), 'arenafit-staging-'));
  const file = join(dir, 'q.sql');
  writeFileSync(file, statement);
  try {
    const r = spawnSync('npx', ['--yes', SUPABASE_CLI, 'db', 'query', '--db-url', env.STAGING_DB_URL, '-f', file, '--output-format', 'json'], {
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      env: { ...process.env, DO_NOT_TRACK: '1' },
    });
    const out = `${r.stdout ?? ''}`.trim();
    const parsed = (() => {
      try {
        return JSON.parse(out.slice(out.indexOf('{')));
      } catch {
        return null;
      }
    })();
    if (r.status === 0 && !parsed && /^(Connecting to remote database\.\.\.\s*)?DO$/.test(out)) return []; // DO block: no rows
    if (r.status !== 0 || !parsed || parsed._tag === 'Error') {
      const message = parsed?.error?.message ?? `${r.stderr ?? ''}${out}`.trim().split('\n').slice(-3).join(' ');
      throw new Error(message.replaceAll(env.STAGING_DB_URL, '<db-url>'));
    }
    return parsed.rows ?? [];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function http(env, method, path, { body, token, anon } = {}) {
  const key = anon ? env.STAGING_ANON_KEY : env.STAGING_SERVICE_ROLE_KEY;
  // Legacy keys are JWTs and go in Authorization too; new sb_* keys only in apikey.
  const bearer = token ?? (key.startsWith('eyJ') ? key : null);
  const res = await fetch(env.STAGING_SUPABASE_URL.replace(/\/+$/, '') + path, {
    method,
    headers: { apikey: key, ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw Object.assign(new Error(`${method} ${path.split('?')[0]} → ${res.status} ${data?.msg ?? data?.message ?? text.slice(0, 160)}`), { status: res.status });
  return data;
}

const quote = (v) => `'${String(v).replace(/'/g, "''")}'`;
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function isMarkedStaging(env) {
  const rows = sql(env, `select value #>> '{}' as env from public.app_settings where key = 'deployment.environment'`);
  return rows[0]?.env === 'staging';
}

// --- commands ----------------------------------------------------------------

function init() {
  if (existsSync(envFile)) fail(`${envFile} already exists — edit it instead.`);
  const pw = () => randomBytes(18).toString('base64url');
  writeFileSync(
    envFile,
    `# Arena Fit — STAGING presentation environment. NEVER COMMIT (git-ignored).
# Fill the five STAGING_* values from the Supabase dashboard of the STAGING project
# (Project Settings → API, and Connect → Session pooler). See docs/STAGING.md.
STAGING_PROJECT_REF=
STAGING_SUPABASE_URL=https://<project-ref>.supabase.co
STAGING_ANON_KEY=
STAGING_SERVICE_ROLE_KEY=
# Session pooler connection string, password percent-encoded:
STAGING_DB_URL=postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres
# Optional safety net: the production project's ref (scripts refuse to touch it).
PRODUCTION_PROJECT_REF=

# Demo accounts (created/reset by \`staging.mjs reset\`). Change the emails if you like.
DEMO_ADMIN_EMAIL=direction@staging.arenafit.invalid
DEMO_ADMIN_PASSWORD=${pw()}
DEMO_CONTENT_EMAIL=contenu@staging.arenafit.invalid
DEMO_CONTENT_PASSWORD=${pw()}
DEMO_RECEPTION_EMAIL=accueil@staging.arenafit.invalid
DEMO_RECEPTION_PASSWORD=${pw()}
# Demo member — signs in on the Android preview build (Profil → Accès démo).
DEMO_MEMBER_EMAIL=membre@staging.arenafit.invalid
DEMO_MEMBER_PASSWORD=${pw()}
DEMO_MEMBER_FIRST_NAME=Sara
DEMO_MEMBER_LAST_NAME=Benali
# Internal member who owns the Guest Pass examples (sent / activated / used),
# so the demo member keeps all 3 passes for the live « Offrir un Pass ».
DEMO_INVITER_EMAIL=karim@staging.arenafit.invalid
DEMO_INVITER_PASSWORD=${pw()}
DEMO_INVITER_FIRST_NAME=Karim
DEMO_INVITER_LAST_NAME=Alaoui
`,
  );
  chmodSync(envFile, 0o600);
  console.log(`✓ ${envFile} created (mode 600). Fill the STAGING_* values, then run: node scripts/staging/staging.mjs check`);
}

async function check() {
  const env = loadEnv();
  const local = checkTarget(env);
  console.log(`✓ configuration targets ${local ? 'a LOCAL rehearsal stack' : `staging project ${env.STAGING_PROJECT_REF}`}`);
  const marked = isMarkedStaging(env);
  console.log(marked ? '✓ database carries the staging marker' : '· database is NOT marked as staging yet (run mark-staging once)');
  const [counts] = sql(
    env,
    `select (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'admin_dashboard_stats') as latest_migration,
            (select count(*) from public.coaches) as coaches, (select count(*) from public.activities) as activities,
            (select count(*) from public.class_sessions) as sessions, (select count(*) from public.news) as news,
            (select count(*) from public.reception_stations where active) as active_stations`,
  );
  console.log(`  ${counts.latest_migration ? 'migrations applied' : 'MIGRATIONS NOT APPLIED'} · coaches ${counts.coaches} · activities ${counts.activities} · sessions ${counts.sessions} · news ${counts.news} · active stations ${counts.active_stations}`);
  const auth = await http(env, 'GET', '/auth/v1/settings', { anon: true });
  console.log(auth.external?.anonymous_users ? '✓ anonymous sign-ins enabled (Guest Pass)' : '✗ anonymous sign-ins are DISABLED — enable them (Authentication → Sign In / Providers)');
}

function markStaging() {
  const env = loadEnv();
  const local = checkTarget(env);
  const confirm = flag('--confirm');
  if (!local && confirm !== env.STAGING_PROJECT_REF) fail(`Confirm with: --confirm ${env.STAGING_PROJECT_REF}`);
  sql(
    env,
    `insert into public.app_settings (key, value, is_public, description)
     values ('deployment.environment', '"staging"', false, 'Staging presentation project — enables supabase/staging/presentation.sql')
     on conflict (key) do update set value = excluded.value`,
  );
  console.log('✓ database marked as staging');
}

async function upsertUser(env, users, email, password, metadata) {
  const existing = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    await http(env, 'PUT', `/auth/v1/admin/users/${existing.id}`, { body: { password, email_confirm: true, user_metadata: metadata } });
    return existing.id;
  }
  const created = await http(env, 'POST', '/auth/v1/admin/users', { body: { email, password, email_confirm: true, user_metadata: metadata } });
  return created.id;
}

async function allUsers(env) {
  const users = [];
  for (let page = 1; page < 50; page++) {
    const r = await http(env, 'GET', `/auth/v1/admin/users?page=${page}&per_page=200`);
    const batch = r.users ?? [];
    users.push(...batch);
    if (batch.length < 200) break;
  }
  return users;
}

async function reset() {
  const env = loadEnv();
  const local = checkTarget(env);
  console.log(`Target: ${local ? 'LOCAL rehearsal stack' : `staging project ${env.STAGING_PROJECT_REF}`}`);
  if (!isMarkedStaging(env)) fail('database is not marked as staging — refusing (see docs/STAGING.md, mark-staging)');
  const auth = await http(env, 'GET', '/auth/v1/settings', { anon: true });
  if (!auth.external?.anonymous_users) fail('anonymous sign-ins are disabled on this project — the Guest Pass needs them');

  step('presentation dataset (supabase/staging/presentation.sql)');
  sql(env, readFileSync(join(ROOT, 'supabase/staging/presentation.sql'), 'utf8'));

  step('demo accounts');
  const users = await allUsers(env);
  const ids = {};
  for (const a of ACCOUNTS) {
    ids[a.key] = await upsertUser(env, users, env[`DEMO_${a.key}_EMAIL`], env[`DEMO_${a.key}_PASSWORD`], {});
    if (!isUuid(ids[a.key])) fail(`unexpected user id for ${a.key}`);
  }
  const staff = ACCOUNTS.filter((a) => a.staffRole);
  const members = [
    { id: ids.MEMBER, first: env.DEMO_MEMBER_FIRST_NAME, last: env.DEMO_MEMBER_LAST_NAME },
    { id: ids.INVITER, first: env.DEMO_INVITER_FIRST_NAME, last: env.DEMO_INVITER_LAST_NAME },
  ];
  sql(
    env,
    `do $accounts$
     begin
       if coalesce((select value #>> '{}' from public.app_settings where key = 'deployment.environment'), '') <> 'staging' then
         raise exception 'REFUSED: not a staging database';
       end if;
       insert into public.admin_users (user_id, role, display_name) values
         ${staff.map((a) => `(${quote(ids[a.key])}, ${quote(a.staffRole)}, ${quote(a.displayName)})`).join(',\n         ')}
       on conflict (user_id) do update set role = excluded.role, display_name = excluded.display_name;
       ${members
         .map(
           (m) => `update public.profiles set kind = 'member', first_name = ${quote(m.first)}, last_name = ${quote(m.last)} where id = ${quote(m.id)};
       delete from public.admin_users where user_id = ${quote(m.id)};
       delete from public.memberships where profile_id = ${quote(m.id)};
       insert into public.memberships (profile_id, plan_name, membership_type, status, starts_on, ends_on)
         values (${quote(m.id)}, 'Abonnement Arena Fit', 'annual', 'active', current_date - 120, current_date + 245);`,
         )
         .join('\n       ')}
     end
     $accounts$`,
  );

  step('Guest Pass examples (sent · activated · used)');
  const session = await http(env, 'POST', '/auth/v1/token?grant_type=password', {
    anon: true,
    body: { email: env.DEMO_INVITER_EMAIL, password: env.DEMO_INVITER_PASSWORD },
  });
  const invite = (name) => http(env, 'POST', '/rest/v1/rpc/create_guest_invitation', { anon: true, token: session.access_token, body: { p_invitee_name: name } });
  const used = await invite('Yassine');
  const activated = await invite('Imane');
  const sent = await invite('Mehdi');
  for (const inv of [used, activated]) {
    const guest = await http(env, 'POST', '/auth/v1/signup', { anon: true, body: {} });
    const r = await http(env, 'POST', '/rest/v1/rpc/activate_guest_invitation', {
      anon: true,
      token: guest.access_token,
      body: { p_token: inv.share_token, p_code: null },
    });
    if (r.result !== 'activated') fail(`activation returned ${r.result}`);
  }
  const ids3 = [used.invitation_id, activated.invitation_id, sent.invitation_id];
  if (!ids3.every(isUuid)) fail('unexpected invitation ids');
  const [station] = sql(env, `select id, name from public.reception_stations where active order by created_at limit 1`);
  // Realistic timeline, and the "used" example checked in at the active station
  // yesterday 18:12 club time — the same records redeem_my_guest_pass writes.
  sql(
    env,
    `do $examples$
     declare
       used_id uuid := ${quote(ids3[0])};
       act_id uuid := ${quote(ids3[1])};
       sent_id uuid := ${quote(ids3[2])};
       station_id uuid := ${station ? quote(station.id) : 'null'};
       v_used_at timestamptz := ((date_trunc('day', now() at time zone public.club_time_zone()) - interval '1 day' + interval '18 hours 12 minutes')
                               at time zone public.club_time_zone());
       pass_id uuid;
       guest_id uuid;
     begin
       if coalesce((select value #>> '{}' from public.app_settings where key = 'deployment.environment'), '') <> 'staging' then
         raise exception 'REFUSED: not a staging database';
       end if;
       update public.guest_invitations set created_at = now() - interval '3 days', activated_at = now() - interval '2 days' where id = used_id;
       update public.guest_invitations set created_at = now() - interval '2 days', activated_at = now() - interval '5 hours' where id = act_id;
       update public.guest_invitations set created_at = now() - interval '1 hour' where id = sent_id;
       update public.guest_pass_events e set created_at = case e.event
           when 'gift_created' then i.created_at else coalesce(i.activated_at, e.created_at) end
         from public.guest_invitations i where i.id = e.invitation_id;
       if station_id is not null then
         select p.id, p.guest_profile_id into pass_id, guest_id from public.guest_passes p where p.invitation_id = used_id;
         insert into public.guest_redemptions (guest_pass_id, guest_profile_id, reception_station_id, redeemed_at)
           values (pass_id, guest_id, station_id, v_used_at);
         update public.guest_invitations set status = 'used', used_at = v_used_at where id = used_id;
         insert into public.guest_pass_events (invitation_id, reception_station_id, event, outcome, actor_id, created_at) values
           (used_id, station_id, 'reception_qr_scanned', 'success', guest_id, v_used_at),
           (used_id, station_id, 'guest_pass_redeemed', 'success', guest_id, v_used_at);
       end if;
     end
     $examples$`,
  );
  if (!station) {
    console.log('  · no active reception station yet: the "used" example stays activated.');
    console.log('    Create the station in the dashboard (Stations réception), print its QR, then run reset again.');
  }

  const [s] = sql(
    env,
    `select (select count(*) from public.class_sessions) as sessions, (select count(*) from public.news) as news,
            (select count(*) from public.guest_invitations) as invitations,
            (select string_agg(status::text, ', ' order by created_at) from public.guest_invitations) as statuses`,
  );
  console.log(`✓ presentation ready: ${s.sessions} classes over two weeks · ${s.news} news · Guest Passes: ${s.statuses}`);
  console.log(`  Reception station: ${station ? `${station.name} (active — keep its printed QR)` : 'none yet'}`);
}

const commands = { init, check, 'mark-staging': markStaging, reset };
if (!commands[command]) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 26).join('\n'));
  process.exit(command === 'help' ? 0 : 2);
}
Promise.resolve(commands[command]()).catch((e) => fail(e.message));
