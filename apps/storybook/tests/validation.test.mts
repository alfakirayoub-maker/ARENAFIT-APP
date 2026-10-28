/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { deepTypeset, typesetFrench } from '../src/lib/typeset.ts';
import { companionSchema, deliverySchema, heroSchema, MOROCCAN_PHONE, normalizePhone } from '../src/lib/validation.ts';

describe('hero validation', () => {
  const ok = (firstName: string) => heroSchema.safeParse({ firstName, age: 5, form: 'f' }).success;
  it('accepts names in any script, with accents, hyphens and apostrophes', () => {
    for (const n of ['Lina', 'Élise-Marie', "N'Golo", 'لينا', 'آدم', 'Zoë']) assert.ok(ok(n), n);
  });
  it('rejects empty, too long, or non-letter names', () => {
    for (const n of ['', '   ', 'A'.repeat(25), 'Lina2', '<script>', '-Lina']) assert.ok(!ok(n), n);
  });
  it('bounds the age and requires a grammatical form', () => {
    assert.ok(!heroSchema.safeParse({ firstName: 'Lina', age: 1, form: 'f' }).success);
    assert.ok(!heroSchema.safeParse({ firstName: 'Lina', age: 13, form: 'f' }).success);
    const missing = heroSchema.safeParse({ firstName: 'Lina', age: 5 });
    assert.equal(missing.error?.issues[0].message, 'formRequired');
  });
});

describe('companion validation', () => {
  it('needs a relationship label for "someone else"', () => {
    const r = companionSchema.safeParse({ name: 'Samira', relationship: 'other', form: 'f', role: 'guide' });
    assert.equal(r.error?.issues[0].message, 'relationshipRequired');
    assert.ok(companionSchema.safeParse({ name: 'Samira', relationship: 'other', relationshipLabel: 'tante', form: 'f', role: 'guide' }).success);
  });
});

describe('delivery validation (Morocco)', () => {
  it('accepts common Moroccan phone spellings', () => {
    for (const p of ['0612345678', '06 12 34 56 78', '+212 6 12 34 56 78', '00212712345678', '05.22.12.34.56']) assert.match(normalizePhone(p), MOROCCAN_PHONE, p);
  });
  it('rejects other numbers', () => {
    for (const p of ['0812345678', '061234567', '+33 6 12 34 56 78', 'abc']) assert.doesNotMatch(normalizePhone(p), MOROCCAN_PHONE, p);
  });
  it('requires an address for printed books and an email for digital ones', () => {
    const base = { fullName: 'Samira Alaoui', phone: '0612345678' };
    assert.ok(!deliverySchema(true).safeParse({ ...base, city: 'Rabat' }).success);
    assert.ok(deliverySchema(true).safeParse({ ...base, city: 'Rabat', address: '12 rue des Orangers' }).success);
    assert.equal(deliverySchema(false).safeParse(base).error?.issues[0].message, 'emailRequired');
    assert.ok(deliverySchema(false).safeParse({ ...base, email: 'samira@example.ma' }).success);
  });
});

describe('French typography', () => {
  it('keeps punctuation attached with narrow no-break spaces', () => {
    assert.equal(typesetFrench('« Comptons ensemble ! »'), '« Comptons ensemble ! »');
    assert.equal(typesetFrench('Pourquoi ? Parce que : voilà ; fin'), 'Pourquoi ? Parce que : voilà ; fin');
  });
  it('applies through nested messages and function results', () => {
    const m = deepTypeset({ a: 'Oui !', b: [(n: number) => `Page ${n} ?`] }, typesetFrench);
    assert.equal(m.a, 'Oui !');
    assert.equal(m.b[0](2), 'Page 2 ?');
  });
});
