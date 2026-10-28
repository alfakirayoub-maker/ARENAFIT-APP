'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { CHILD_AGE, TEXT_LIMITS } from '@/config/catalog';
import { useI18n } from '@/i18n/client';
import { heroSchema, type HeroValues } from '@/lib/validation';
import { useStoryStore } from '@/store/story';

import { AgeStepper, FieldError, Label, PhotoField, Segmented, TextInput, useErrorText } from '../fields';
import { StepFrame } from '../StepFrame';

export function HeroStep({ onNext }: { sub: number; onNext: () => void }) {
  const { t } = useI18n();
  const err = useErrorText();
  const child = useStoryStore((s) => s.draft.child);
  const updateChild = useStoryStore((s) => s.updateChild);
  const [consentError, setConsentError] = useState(false);

  const { register, control, handleSubmit, subscribe, formState } = useForm<HeroValues>({
    resolver: zodResolver(heroSchema),
    defaultValues: { firstName: child.firstName, age: child.age, form: child.form },
    mode: 'onTouched',
  });

  // Live sync: the cover preview updates as the parent types.
  useEffect(
    () => subscribe({ formState: { values: true }, callback: ({ values: v }) => updateChild({ firstName: v.firstName ?? '', age: v.age, form: v.form }) }),
    [subscribe, updateChild],
  );

  const submit = handleSubmit(() => {
    if (child.photo && !child.photoConsent) return setConsentError(true);
    onNext();
  });

  const s = t.studio.hero;
  const e = formState.errors;

  return (
    <StepFrame kicker={s.kicker} title={s.title} onSubmit={submit}>
      <div className="space-y-7">
        <div>
          <Label htmlFor="child-name">{s.name}</Label>
          <TextInput
            id="child-name"
            display
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            maxLength={TEXT_LIMITS.name + 4}
            placeholder={s.namePlaceholder}
            aria-invalid={!!e.firstName || undefined}
            aria-describedby="child-name-help child-name-error"
            {...register('firstName')}
          />
          <p id="child-name-help" className="mt-2 text-[0.85rem] text-ink-muted">
            {s.nameHelp}
          </p>
          <FieldError id="child-name-error">{err(e.firstName?.message)}</FieldError>
        </div>

        <div className="grid gap-7 sm:grid-cols-2 sm:gap-5">
          <div>
            <Label>{s.age}</Label>
            <Controller
              control={control}
              name="age"
              render={({ field }) => (
                <AgeStepper id="child-age" value={field.value} onChange={(n) => field.onChange(n)} min={CHILD_AGE.min} max={CHILD_AGE.max} format={s.years} labels={{ decrease: s.decrease, increase: s.increase }} />
              )}
            />
            <FieldError>{err(e.age?.message)}</FieldError>
          </div>
          <div>
            <Label>{s.form}</Label>
            <Controller
              control={control}
              name="form"
              render={({ field }) => (
                <Segmented
                  name="child-form"
                  label={s.form}
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: 'm', label: s.formM },
                    { value: 'f', label: s.formF },
                  ]}
                />
              )}
            />
            <FieldError>{err(e.form?.message)}</FieldError>
          </div>
        </div>

        <PhotoField
          label={s.photo}
          photo={child.photo}
          consent={child.photoConsent}
          onChange={(photo) => updateChild({ photo })}
          onConsent={(photoConsent) => {
            updateChild({ photoConsent });
            if (photoConsent) setConsentError(false);
          }}
          altName={child.firstName || '…'}
          consentError={consentError}
        />
      </div>
    </StepFrame>
  );
}
