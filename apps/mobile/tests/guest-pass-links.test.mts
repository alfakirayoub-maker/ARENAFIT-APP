/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createBranchLinkService, createLocalLinkService, type BranchLike } from '../src/features/guest-pass/link-service.ts';
import {
  buildInvitationUrl,
  buildShareMessage,
  isShareToken,
  normalizeShortCode,
  parseBranchParams,
  parseReceptionQr,
  resolveIncomingUrl,
  type InvitationRef,
  type LinkConfig,
} from '../src/features/guest-pass/links.ts';

const TOKEN = 'q3Jx8Yb2mN0pQrStUvWxYz0123456789_-AbCdEfGhI'; // 43 base64url chars
const OTHER = 'Z'.repeat(43);

const branch: LinkConfig = {
  branchDomain: 'arenafit-test.app.link',
  branchAlternateDomain: 'arenafit-test-alternate.app.link',
  inviteBaseUrl: null,
  scheme: 'arenafit',
};
const local: LinkConfig = { branchDomain: null, branchAlternateDomain: null, inviteBaseUrl: 'https://staging.example.test/', scheme: 'arenafit' };
const bare: LinkConfig = { branchDomain: null, branchAlternateDomain: null, inviteBaseUrl: null, scheme: 'arenafit' };

describe('share tokens and codes', () => {
  it('accepts only 43-char base64url tokens', () => {
    assert.equal(TOKEN.length, 43);
    assert.ok(isShareToken(TOKEN));
    for (const bad of [TOKEN.slice(1), `${TOKEN}A`, TOKEN.replace('q', '+'), '', null, 42, {}]) assert.equal(isShareToken(bad), false);
  });

  it('normalises typed codes like the server', () => {
    assert.equal(normalizeShortCode('af-7k4p-9xyz'), 'AF-7K4P-9XYZ');
    assert.equal(normalizeShortCode(' AF 7K4P 9XYZ '), 'AF-7K4P-9XYZ');
    assert.equal(normalizeShortCode('7K4P9XYZ'), 'AF-7K4P-9XYZ');
    // Look-alike characters are not in the alphabet; wrong lengths are refused.
    assert.equal(normalizeShortCode('AF-7K4P-9XY0'), null);
    assert.equal(normalizeShortCode('AF-7K4P-9XYI'), null);
    assert.equal(normalizeShortCode('AF-7K4P'), null);
    assert.equal(normalizeShortCode('AF-7K4P-9XYZ-2'), null);
  });
});

describe('invitation URLs and message', () => {
  it('uses the Branch domain when configured, else the public base, else the app scheme', () => {
    assert.equal(buildInvitationUrl(TOKEN, branch), `https://arenafit-test.app.link/?af_invite=${TOKEN}`);
    assert.equal(buildInvitationUrl(TOKEN, local), `https://staging.example.test/invite/${TOKEN}`);
    assert.equal(buildInvitationUrl(TOKEN, bare), `arenafit://invite/${TOKEN}`);
    assert.throws(() => buildInvitationUrl('nope', branch));
  });

  it('builds the agreed share message with the link (not the QR)', () => {
    const url = buildInvitationUrl(TOKEN, branch);
    assert.equal(
      buildShareMessage(url),
      `🎁 Je t’offre une séance chez Arena Fit.\nDécouvre le club avec ton Pass Invité.\nTélécharge ou ouvre l’application Arena Fit pour activer ton cadeau :\n${url}`,
    );
  });
});

describe('Branch payloads', () => {
  it('accepts a clicked Branch link carrying a valid token', () => {
    assert.deepEqual(parseBranchParams({ '+clicked_branch_link': true, af_invite: TOKEN, '~channel': 'whatsapp' }), {
      kind: 'token',
      token: TOKEN,
    });
  });

  it('rejects malformed or untrusted payloads', () => {
    const cases: unknown[] = [
      null,
      undefined,
      'af_invite=' + TOKEN,
      [TOKEN],
      { af_invite: TOKEN }, // not from a clicked link
      { '+clicked_branch_link': 'true', af_invite: TOKEN },
      { '+clicked_branch_link': true },
      { '+clicked_branch_link': true, af_invite: TOKEN + '/../admin' },
      { '+clicked_branch_link': true, af_invite: 123 },
      { '+clicked_branch_link': true, $deeplink_path: 'admin', $canonical_url: 'https://evil.test' },
      { '+clicked_branch_link': true, af_invite: { token: TOKEN } },
    ];
    for (const p of cases) assert.equal(parseBranchParams(p), null, JSON.stringify(p));
  });

  it('the Branch adapter forwards only validated invitations', () => {
    let handler: ((e: { error?: string | null; params?: unknown }) => void) | undefined;
    let unsubscribed = false;
    const fake: BranchLike = {
      subscribe: ({ onOpenComplete }) => {
        handler = onOpenComplete;
        return () => {
          unsubscribed = true;
        };
      },
    };
    const service = createBranchLinkService(fake, branch);
    const received: InvitationRef[] = [];
    const stop = service.subscribe((r) => received.push(r));

    handler!({ error: 'network', params: { '+clicked_branch_link': true, af_invite: TOKEN } });
    handler!({ params: { '+clicked_branch_link': false, '+is_first_session': true } }); // plain open
    handler!({ params: { '+clicked_branch_link': true, af_invite: 'javascript:alert(1)' } });
    // Deferred deep link: first session after install carries the link data.
    handler!({ params: { '+clicked_branch_link': true, '+is_first_session': true, af_invite: TOKEN } });

    assert.deepEqual(received, [{ kind: 'token', token: TOKEN }]);
    stop();
    assert.ok(unsubscribed);
    assert.equal(service.buildShareUrl(TOKEN), `https://arenafit-test.app.link/?af_invite=${TOKEN}`);
  });

  it('the local adapter never uses Branch and delivers nothing by itself', () => {
    const service = createLocalLinkService({ ...branch, inviteBaseUrl: 'https://staging.example.test' });
    assert.equal(service.provider, 'local');
    assert.equal(service.buildShareUrl(TOKEN), `https://staging.example.test/invite/${TOKEN}`);
    const received: InvitationRef[] = [];
    service.subscribe((r) => received.push(r))();
    assert.deepEqual(received, []);
  });
});

describe('incoming URLs (+native-intent)', () => {
  it('routes valid invitation links to the preview', () => {
    assert.equal(resolveIncomingUrl(`arenafit://invite/${TOKEN}`, branch), `/invite/${TOKEN}`);
    assert.equal(resolveIncomingUrl(`https://arenafit-test.app.link/?af_invite=${TOKEN}`, branch), `/invite/${TOKEN}`);
    assert.equal(resolveIncomingUrl(`https://ARENAFIT-TEST-ALTERNATE.app.link/x?af_invite=${TOKEN}`, branch), `/invite/${TOKEN}`);
    assert.equal(resolveIncomingUrl(`https://staging.example.test/invite/${TOKEN}`, local), `/invite/${TOKEN}`);
    assert.equal(resolveIncomingUrl(`/invite/${TOKEN}`, bare), `/invite/${TOKEN}`);
  });

  it('sends malformed invitations to the invalid-invitation screen', () => {
    assert.equal(resolveIncomingUrl('arenafit://invite/abc', branch), '/invite/invalid');
    assert.equal(resolveIncomingUrl(`arenafit://invite/${TOKEN}%2F..%2Fadmin`, branch), '/invite/invalid');
  });

  it('never routes foreign or unsafe URLs', () => {
    for (const url of [
      `https://evil.test/invite/${TOKEN}`,
      `http://arenafit-test.app.link/?af_invite=${TOKEN}`,
      'javascript:alert(1)',
      'file:///etc/passwd',
      '//evil.test/path',
      'not a url',
      `https://arenafit-test.app.link/?af_invite=${OTHER}x`,
      'arenafit://classes/<script>',
    ]) {
      assert.equal(resolveIncomingUrl(url, branch), '/', url);
    }
  });

  it('keeps other safe app paths for Expo Router (unknown ones show the not-found screen)', () => {
    assert.equal(resolveIncomingUrl('arenafit://classes/0b7c', branch), '/classes/0b7c');
    assert.equal(resolveIncomingUrl('arenafit://does-not-exist', branch), '/does-not-exist');
    assert.equal(resolveIncomingUrl('arenafit://', branch), '/');
  });
});

describe('reception QR (scanned by the guest)', () => {
  const STATION = `AFR1.${OTHER}`;

  it('accepts only the Arena Fit reception format', () => {
    assert.equal(parseReceptionQr(STATION), STATION);
    assert.equal(parseReceptionQr(`  ${STATION}\n`), STATION, 'scanner whitespace is trimmed');
  });

  it('rejects URLs, invitation links, other codes and malformed strings — nothing is opened', () => {
    for (const bad of [
      'https://example.com/promo',
      `https://arenafit-test.app.link/?af_invite=${TOKEN}`,
      `arenafit://invite/${TOKEN}`,
      `http://localhost:8099/invite/${TOKEN}`,
      'AF-7K4P-9XYZ',
      `AFG1.${TOKEN}`, // the removed guest-QR format
      `AFR2.${TOKEN}`,
      'AFR1.',
      `AFR1.${TOKEN}x`,
      `AFR1.${TOKEN.slice(1)}`,
      `afr1.${TOKEN}`,
      `AFR1.${TOKEN.replace('q', '/')}`,
      'WIFI:S:arena;T:WPA;P:secret;;',
      '',
      null,
      42,
    ]) {
      assert.equal(parseReceptionQr(bad), null, String(bad));
    }
  });
});
