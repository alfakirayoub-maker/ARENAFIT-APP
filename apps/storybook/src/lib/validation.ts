import { z } from 'zod';

import { CHILD_AGE, TEXT_LIMITS } from '@/config/catalog';
import {
  ADVENTURES,
  CHARACTER_ROLES,
  LEARNING_OBJECTIVES,
  LOCALES,
  READING_LEVELS,
  RELATIONSHIPS,
  WORLDS,
} from '@/lib/engine/types';

/**
 * Validation messages are keys into `t.studio.errors` / `t.order.fieldErrors`,
 * translated at render time so one schema serves all three languages.
 */

// Letters of any script (Latin with accents, Arabic…), combining marks, spaces, hyphens, apostrophes.
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'’-]*$/u;

export const nameField = z
  .string()
  .trim()
  .min(1, 'nameRequired')
  .max(TEXT_LIMITS.name, 'nameTooLong')
  .regex(NAME_PATTERN, 'nameInvalid');

const photoSchema = z.object({ dataUrl: z.string().startsWith('data:image/'), width: z.number(), height: z.number() });

export const heroSchema = z.object({
  firstName: nameField,
  age: z.number({ error: 'ageRange' }).int('ageRange').min(CHILD_AGE.min, 'ageRange').max(CHILD_AGE.max, 'ageRange'),
  form: z.enum(['m', 'f'], { error: 'formRequired' }),
});
export type HeroValues = z.infer<typeof heroSchema>;

export const companionSchema = z
  .object({
    name: z.string().trim().min(1, 'companionName').max(TEXT_LIMITS.name, 'nameTooLong').regex(NAME_PATTERN, 'nameInvalid'),
    relationship: z.enum(RELATIONSHIPS),
    relationshipLabel: z.string().trim().max(TEXT_LIMITS.relationshipLabel, 'tooLong').optional(),
    form: z.enum(['m', 'f'], { error: 'formRequired' }),
    role: z.enum(CHARACTER_ROLES, { error: 'choose' }),
  })
  .refine((v) => v.relationship !== 'other' || !!v.relationshipLabel?.trim(), { path: ['relationshipLabel'], message: 'relationshipRequired' });
export type CompanionValues = z.infer<typeof companionSchema>;

export const configurationSchema = z.object({
  version: z.literal(1),
  child: heroSchema.extend({ photo: photoSchema.optional() }),
  storyLanguage: z.enum(LOCALES),
  readingLevel: z.enum(READING_LEVELS),
  objective: z.enum(LEARNING_OBJECTIVES),
  world: z.enum(WORLDS),
  companions: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1),
        relationship: z.enum(RELATIONSHIPS),
        relationshipLabel: z.string().optional(),
        form: z.enum(['m', 'f']),
        role: z.enum(CHARACTER_ROLES),
        photo: photoSchema.optional(),
      }),
    )
    .max(1),
  adventure: z.discriminatedUnion('kind', [z.object({ kind: z.literal('mission'), id: z.enum(ADVENTURES) }), z.object({ kind: z.literal('surprise') })]),
  customIdea: z.string().max(TEXT_LIMITS.idea).optional(),
  dedication: z.string().max(TEXT_LIMITS.dedication).optional(),
});

/** Moroccan numbers: 05/06/07 + 8 digits, or +212 / 00212 followed by 9 digits. Spaces, dots and dashes allowed. */
export const MOROCCAN_PHONE = /^(?:\+212|00212|0)[5-7]\d{8}$/;
export const normalizePhone = (value: string) => value.replace(/[\s.\-()]/g, '');

export function deliverySchema(physical: boolean) {
  const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));
  return z.object({
    fullName: z.string().trim().min(3, 'fullName').max(80, 'fullName'),
    phone: z.string().refine((v) => MOROCCAN_PHONE.test(normalizePhone(v)), 'phone'),
    email: physical ? z.email('email').optional().or(z.literal('')) : z.email('emailRequired'),
    city: physical ? z.string().trim().min(2, 'city').max(60, 'city') : optionalText(60),
    address: physical ? z.string().trim().min(5, 'address').max(200, 'address') : optionalText(200),
    postalCode: z.string().trim().regex(/^\d{5}$/, 'postalCode').optional().or(z.literal('')),
    notes: optionalText(240),
  });
}
export type DeliveryValues = z.infer<ReturnType<typeof deliverySchema>>;
