'use client';

import { BookOpenText, HeartHandshake, Leaf, Mountain, Palette, PawPrint, Puzzle, Smile } from 'lucide-react';
import { useState } from 'react';

import { useI18n } from '@/i18n/client';
import { LEARNING_OBJECTIVES, type LearningObjectiveId } from '@/lib/engine/types';
import { useStoryStore } from '@/store/story';

import { ChoiceTile, FieldError } from '../fields';
import { StepFrame } from '../StepFrame';

/** Medallion art per objective: an icon (or numerals) on its own soft colour. */
const MEDALLIONS: Record<LearningObjectiveId, { bg: string; fg: string; icon?: typeof Palette }> = {
  colors: { bg: 'bg-coral/40', fg: 'text-coral-deep', icon: Palette },
  numbers: { bg: 'bg-gold/35', fg: 'text-gold-deep' },
  animals: { bg: 'bg-sage/70', fg: 'text-sage-deep', icon: PawPrint },
  vocabulary: { bg: 'bg-lavender', fg: 'text-lavender-deep', icon: BookOpenText },
  friendship: { bg: 'bg-coral/40', fg: 'text-coral-deep', icon: HeartHandshake },
  emotions: { bg: 'bg-gold/35', fg: 'text-gold-deep', icon: Smile },
  nature: { bg: 'bg-sage/70', fg: 'text-sage-deep', icon: Leaf },
  confidence: { bg: 'bg-lavender', fg: 'text-lavender-deep', icon: Mountain },
  'problem-solving': { bg: 'bg-coral/40', fg: 'text-coral-deep', icon: Puzzle },
};

export function ObjectiveStep({ onNext }: { sub: number; onNext: () => void }) {
  const { t } = useI18n();
  const draft = useStoryStore((s) => s.draft);
  const update = useStoryStore((s) => s.update);
  const [tried, setTried] = useState(false);
  const s = t.studio.objective;

  return (
    <StepFrame
      kicker={s.kicker}
      title={draft.child.form === 'f' ? s.titleF : s.title}
      help={s.help}
      wide
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (draft.objective) onNext();
      }}
    >
      <fieldset>
        <legend className="sr-only">{s.title}</legend>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {LEARNING_OBJECTIVES.map((o) => {
            const m = MEDALLIONS[o];
            const Icon = m.icon;
            return (
              <ChoiceTile key={o} name="objective" value={o} checked={draft.objective === o} onSelect={() => update({ objective: o })}>
                <span className="flex w-full flex-col items-center px-1.5 pt-4 pb-3.5 text-center sm:px-3 sm:pt-5">
                  <span className={`grid size-12 place-items-center rounded-full ${m.bg} ${m.fg} ring-1 ring-white/70 ring-offset-2 ring-offset-transparent sm:size-14`} aria-hidden>
                    {Icon ? <Icon className="size-6 sm:size-7" strokeWidth={1.6} /> : <span className="font-display text-lg leading-none font-semibold">123</span>}
                  </span>
                  <span className="mt-2.5 text-[0.9rem] leading-tight font-medium sm:text-base">{t.catalog.objectives[o].label}</span>
                  <span className="mt-1 hidden text-[0.8rem] leading-snug text-ink-muted sm:block">{t.catalog.objectives[o].hint}</span>
                </span>
              </ChoiceTile>
            );
          })}
        </div>
        <FieldError>{tried && !draft.objective ? t.studio.errors.choose : undefined}</FieldError>
      </fieldset>
    </StepFrame>
  );
}
