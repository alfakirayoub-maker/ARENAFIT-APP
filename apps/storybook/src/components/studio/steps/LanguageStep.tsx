'use client';

import { useState } from 'react';

import { suggestReadingLevel } from '@/config/catalog';
import { MESSAGES } from '@/i18n';
import { useI18n } from '@/i18n/client';
import { LOCALES, READING_LEVELS, type Locale } from '@/lib/engine/types';
import { useStoryStore } from '@/store/story';

import { ChoiceTile, FieldError } from '../fields';
import { StepFrame } from '../StepFrame';

const OPENINGS = { fr: 'Il était une fois…', en: 'Once upon a time…', ar: 'كان يا ما كان…' } as const;

export function LanguageStep({ onNext }: { sub: number; onNext: () => void }) {
  const { t } = useI18n();
  const draft = useStoryStore((s) => s.draft);
  const update = useStoryStore((s) => s.update);
  const [tried, setTried] = useState(false);
  const s = t.studio.language;
  const name = draft.child.firstName.trim();
  const suggested = suggestReadingLevel(draft.child.age);
  const updateCompanion = useStoryStore((st) => st.updateCompanion);

  const chooseLanguage = (l: Locale) => {
    update({ storyLanguage: l });
    // A default nickname ("Mamie", "Grandma", "جدّتي") is book text: translate it with the story.
    const { relationship, name } = draft.companion;
    if (!relationship) return;
    const isDefault = Object.values(MESSAGES).some((m) => m.catalog.relationships[relationship].defaultName === name.trim());
    if (isDefault) updateCompanion({ name: MESSAGES[l].catalog.relationships[relationship].defaultName });
  };

  return (
    <StepFrame
      kicker={s.kicker}
      title={draft.child.form === 'f' ? s.titleF(name) : s.title(name)}
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (draft.storyLanguage && draft.readingLevel) onNext();
      }}
    >
      <fieldset>
        <legend className="sr-only">{s.kicker}</legend>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {LOCALES.map((l) => (
            <ChoiceTile key={l} name="story-language" value={l} checked={draft.storyLanguage === l} onSelect={() => chooseLanguage(l)}>
              <span className="flex w-full flex-col items-center px-2 pt-8 pb-4 text-center sm:pt-6">
                <span lang={l} className="font-display text-[1.3rem] leading-none sm:text-2xl">
                  {t.languages[l]}
                </span>
                <span lang={l} dir={l === 'ar' ? 'rtl' : 'ltr'} className="mt-2 text-[0.8rem] text-ink-muted italic">
                  {OPENINGS[l]}
                </span>
              </span>
            </ChoiceTile>
          ))}
        </div>
        <FieldError>{tried && !draft.storyLanguage ? t.studio.errors.choose : undefined}</FieldError>
      </fieldset>

      <fieldset className="mt-9">
        <legend className="font-display text-xl">{s.levelTitle}</legend>
        <p className="mt-1 text-[0.9rem] text-ink-muted">{s.levelHelp}</p>
        <div className="mt-4 grid gap-2.5">
          {READING_LEVELS.map((lv, i) => (
            <ChoiceTile key={lv} name="reading-level" value={lv} checked={draft.readingLevel === lv} onSelect={() => update({ readingLevel: lv })}>
              <span className="flex w-full items-center gap-4 px-4 py-3.5 pe-10">
                <span className="flex shrink-0 gap-1" aria-hidden>
                  {[0, 1, 2].map((k) => (
                    <span key={k} className={`h-6 w-1.5 rounded-full ${k <= i ? 'bg-gold' : 'bg-ink/10'}`} />
                  ))}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {t.catalog.levels[lv].label}
                    {suggested === lv && <span className="rounded-full bg-sage/70 px-2 py-0.5 text-[0.72rem] font-semibold text-sage-deep">{s.suggested}</span>}
                  </span>
                  <span className="mt-0.5 block text-[0.88rem] text-ink-muted">{t.catalog.levels[lv].hint}</span>
                </span>
              </span>
            </ChoiceTile>
          ))}
        </div>
        <FieldError>{tried && !draft.readingLevel ? t.studio.errors.choose : undefined}</FieldError>
      </fieldset>
    </StepFrame>
  );
}
