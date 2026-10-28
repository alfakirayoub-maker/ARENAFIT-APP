'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, Compass, Heart, Sparkles, UserPlus, Users, UsersRound, WandSparkles, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { TEXT_LIMITS } from '@/config/catalog';
import { useI18n } from '@/i18n/client';
import { MESSAGES } from '@/i18n';
import { CHARACTER_ROLES, type CharacterRoleId, type GrammaticalForm, type RelationshipId } from '@/lib/engine/types';
import { companionSchema, type CompanionValues } from '@/lib/validation';
import { useStoryStore, type CompanionChoice } from '@/store/story';

import { ChoiceTile, FieldError, Label, PhotoField, Segmented, TextInput, useErrorText } from '../fields';
import { StepFrame } from '../StepFrame';

const CHOICES: { id: CompanionChoice; icon: LucideIcon }[] = [
  { id: 'none', icon: Sparkles },
  { id: 'mother', icon: Heart },
  { id: 'father', icon: Heart },
  { id: 'grandparents', icon: Users },
  { id: 'sibling', icon: UsersRound },
  { id: 'other', icon: UserPlus },
];

const FORM_OF: Partial<Record<RelationshipId, GrammaticalForm>> = { mother: 'f', father: 'm', grandmother: 'f', grandfather: 'm', brother: 'm', sister: 'f' };
const ROLE_ICONS: Record<CharacterRoleId, LucideIcon> = { 'adventure-partner': Heart, guide: BookOpen, explorer: Compass, 'magical-helper': WandSparkles };

/** Every default nickname in every language — replaced when the parent switches relationship. */
const DEFAULT_NAMES = new Set(Object.values(MESSAGES).flatMap((m) => Object.values(m.catalog.relationships).map((r) => r.defaultName)).filter(Boolean));

export function CompanionStep({ sub, onNext }: { sub: number; onNext: () => void }) {
  return sub === 0 ? <WhoStep onNext={onNext} /> : <DetailsStep onNext={onNext} />;
}

function WhoStep({ onNext }: { onNext: () => void }) {
  const { t, locale } = useI18n();
  const draft = useStoryStore((s) => s.draft);
  const update = useStoryStore((s) => s.update);
  const updateCompanion = useStoryStore((s) => s.updateCompanion);
  const [tried, setTried] = useState(false);
  const s = t.studio.companion;
  const choice = draft.companionChoice;
  const relationship = draft.companion.relationship;

  const setRelationship = (rel: RelationshipId) => {
    const current = draft.companion.name.trim();
    updateCompanion({
      relationship: rel,
      form: FORM_OF[rel] ?? draft.companion.form,
      // The nickname is printed in the book, so it follows the story's language.
      name: !current || DEFAULT_NAMES.has(current) ? MESSAGES[draft.storyLanguage ?? locale].catalog.relationships[rel].defaultName : current,
    });
  };

  const choose = (c: CompanionChoice) => {
    update({ companionChoice: c });
    if (c === 'mother' || c === 'father' || c === 'other') setRelationship(c);
    else if (c === 'grandparents' && relationship !== 'grandmother' && relationship !== 'grandfather') updateCompanion({ relationship: undefined });
    else if (c === 'sibling' && relationship !== 'brother' && relationship !== 'sister') updateCompanion({ relationship: undefined });
  };

  const needsRefine = choice === 'grandparents' || choice === 'sibling';
  const refined = !needsRefine || !!relationship;

  return (
    <StepFrame
      kicker={s.kicker}
      title={s.title}
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (choice && refined) onNext();
      }}
    >
      <fieldset>
        <legend className="sr-only">{s.title}</legend>
        <div className="grid grid-cols-2 gap-2.5">
          {CHOICES.map(({ id, icon: Icon }) => (
            <ChoiceTile key={id} name="companion" value={id} checked={choice === id} onSelect={() => choose(id)} className={id === 'none' ? 'col-span-2' : ''}>
              <span className={`flex w-full items-center gap-3 px-4 py-4 pe-10 ${id === 'none' ? '' : 'flex-col items-start sm:flex-row sm:items-center'}`}>
                <span className={`grid size-10 shrink-0 place-items-center rounded-full ${id === 'none' ? 'bg-lavender text-lavender-deep' : 'bg-coral/35 text-coral-deep'}`} aria-hidden>
                  <Icon className="size-5" strokeWidth={1.8} />
                </span>
                <span>
                  <span className="block font-medium">{s[id]}</span>
                  {id === 'none' && <span className="block text-[0.85rem] text-ink-muted">{s.noneHint}</span>}
                </span>
              </span>
            </ChoiceTile>
          ))}
        </div>
        <FieldError>{tried && !choice ? t.studio.errors.choose : undefined}</FieldError>
      </fieldset>

      <AnimatePresence>
        {needsRefine && (
          <motion.div key={choice} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <p className="mt-7 mb-3 font-medium">{choice === 'grandparents' ? s.whichGrandparent : s.whichSibling}</p>
            <Segmented
              name="refine"
              label={choice === 'grandparents' ? s.whichGrandparent : s.whichSibling}
              value={relationship}
              onChange={setRelationship}
              options={(choice === 'grandparents' ? (['grandmother', 'grandfather'] as const) : (['sister', 'brother'] as const)).map((r) => ({ value: r, label: t.catalog.relationships[r].label }))}
            />
            <FieldError>{tried && !relationship ? t.studio.errors.choose : undefined}</FieldError>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="mt-8 text-[0.85rem] text-ink-muted italic">{s.later}</p>
    </StepFrame>
  );
}

function DetailsStep({ onNext }: { onNext: () => void }) {
  const { t } = useI18n();
  const err = useErrorText();
  const companion = useStoryStore((s) => s.draft.companion);
  const updateCompanion = useStoryStore((s) => s.updateCompanion);
  const [consentError, setConsentError] = useState(false);
  const s = t.studio.companion;
  const isOther = companion.relationship === 'other';

  const { register, control, handleSubmit, subscribe, formState } = useForm<CompanionValues>({
    resolver: zodResolver(companionSchema),
    defaultValues: {
      name: companion.name,
      relationship: companion.relationship ?? 'other',
      relationshipLabel: companion.relationshipLabel,
      form: companion.form,
      role: companion.role,
    },
    mode: 'onTouched',
  });

  useEffect(
    () =>
      subscribe({
        formState: { values: true },
        callback: ({ values: v }) => updateCompanion({ name: v.name ?? '', relationshipLabel: v.relationshipLabel ?? '', form: v.form, role: v.role }),
      }),
    [subscribe, updateCompanion],
  );

  const submit = handleSubmit(() => {
    if (companion.photo && !companion.photoConsent) return setConsentError(true);
    onNext();
  });
  const e = formState.errors;

  return (
    <StepFrame kicker={s.kicker} title={companion.relationship ? t.catalog.relationships[companion.relationship].label : s.title} onSubmit={submit}>
      <div className="space-y-7">
        <div>
          <Label htmlFor="companion-name">{s.name}</Label>
          <TextInput
            id="companion-name"
            display
            autoComplete="off"
            maxLength={TEXT_LIMITS.name + 4}
            placeholder={s.namePlaceholder}
            aria-invalid={!!e.name || undefined}
            aria-describedby="companion-name-error"
            {...register('name')}
          />
          <FieldError id="companion-name-error">{err(e.name?.message)}</FieldError>
        </div>

        {isOther && (
          <div className="grid gap-7 sm:grid-cols-[1.4fr_1fr] sm:gap-5">
            <div>
              <Label htmlFor="companion-rel">{s.relationshipLabel}</Label>
              <TextInput id="companion-rel" maxLength={TEXT_LIMITS.relationshipLabel} placeholder={s.relationshipPlaceholder} aria-invalid={!!e.relationshipLabel || undefined} {...register('relationshipLabel')} />
              <FieldError>{err(e.relationshipLabel?.message)}</FieldError>
            </div>
            <div>
              <Label>{s.form}</Label>
              <Controller
                control={control}
                name="form"
                render={({ field }) => (
                  <Segmented
                    name="companion-form"
                    label={s.form}
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: 'f', label: s.formF },
                      { value: 'm', label: s.formM },
                    ]}
                  />
                )}
              />
              <FieldError>{err(e.form?.message)}</FieldError>
            </div>
          </div>
        )}

        <fieldset>
          <legend className="mb-3 text-[0.95rem] font-medium">{s.role}</legend>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2.5">
                {CHARACTER_ROLES.map((r) => {
                  const Icon = ROLE_ICONS[r];
                  return (
                    <ChoiceTile key={r} name="companion-role" value={r} checked={field.value === r} onSelect={() => field.onChange(r)}>
                      <span className="flex w-full flex-col items-start gap-2 px-3.5 py-3.5 pe-9">
                        <Icon className="size-5 text-gold-deep" aria-hidden />
                        <span className="text-[0.95rem] leading-tight font-medium">{t.catalog.roles[r].label}</span>
                        <span className="text-[0.8rem] leading-snug text-ink-muted">{t.catalog.roles[r].hint}</span>
                      </span>
                    </ChoiceTile>
                  );
                })}
              </div>
            )}
          />
          <FieldError>{err(e.role?.message)}</FieldError>
        </fieldset>

        <PhotoField
          label={s.photo}
          photo={companion.photo}
          consent={companion.photoConsent}
          onChange={(photo) => updateCompanion({ photo })}
          onConsent={(photoConsent) => {
            updateCompanion({ photoConsent });
            if (photoConsent) setConsentError(false);
          }}
          altName={companion.name || '…'}
          consentError={consentError}
        />
      </div>
    </StepFrame>
  );
}
