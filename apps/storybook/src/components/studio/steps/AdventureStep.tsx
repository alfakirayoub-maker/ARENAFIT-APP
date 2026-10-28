'use client';

import { Compass, DoorOpen, Gem, KeyRound, Rabbit, Shuffle, Sprout, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { TEXT_LIMITS } from '@/config/catalog';
import { useI18n } from '@/i18n/client';
import { ADVENTURES, type AdventureId } from '@/lib/engine/types';
import { useStoryStore } from '@/store/story';

import { ChoiceTile, FieldError, Label, TextArea } from '../fields';
import { StepFrame } from '../StepFrame';

const ICONS: Record<AdventureId, LucideIcon> = {
  'lost-treasure': Gem,
  'magical-creature': Rabbit,
  'ancient-mystery': KeyRound,
  'unknown-world': Compass,
  'save-garden': Sprout,
  'hidden-door': DoorOpen,
};

export function AdventureStep({ sub, onNext }: { sub: number; onNext: () => void }) {
  return sub === 0 ? <MissionStep onNext={onNext} /> : <TouchStep onNext={onNext} />;
}

function MissionStep({ onNext }: { onNext: () => void }) {
  const { t } = useI18n();
  const adventure = useStoryStore((s) => s.draft.adventure);
  const update = useStoryStore((s) => s.update);
  const [tried, setTried] = useState(false);
  const s = t.studio.adventure;
  const selected = adventure?.kind === 'surprise' ? 'surprise' : adventure?.id;

  return (
    <StepFrame
      kicker={s.kicker}
      title={s.title}
      wide
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (adventure) onNext();
      }}
    >
      <fieldset>
        <legend className="sr-only">{s.title}</legend>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          {ADVENTURES.map((a) => {
            const Icon = ICONS[a];
            return (
              <ChoiceTile key={a} name="adventure" value={a} checked={selected === a} onSelect={() => update({ adventure: { kind: 'mission', id: a } })}>
                <span className="flex w-full flex-col items-start gap-2 px-3.5 pt-4 pb-3.5 pe-8">
                  <Icon className="size-6 text-lavender-deep" strokeWidth={1.6} aria-hidden />
                  <span className="text-[0.95rem] leading-tight font-medium">{t.catalog.adventures[a].label}</span>
                  <span className="text-[0.8rem] leading-snug text-ink-muted">{t.catalog.adventures[a].hint}</span>
                </span>
              </ChoiceTile>
            );
          })}
          <ChoiceTile name="adventure" value="surprise" tone="gold" checked={selected === 'surprise'} onSelect={() => update({ adventure: { kind: 'surprise' } })} className="col-span-2 sm:col-span-3">
            <span className="flex w-full items-center gap-3 px-4 py-4 pe-10">
              <Shuffle className="size-6 text-gold-deep" aria-hidden />
              <span>
                <span className="font-display block text-lg">{s.surprise}</span>
                <span className="block text-[0.85rem] text-ink-muted">{s.surpriseHint}</span>
              </span>
            </span>
          </ChoiceTile>
        </div>
        <FieldError>{tried && !adventure ? t.studio.errors.choose : undefined}</FieldError>
      </fieldset>
    </StepFrame>
  );
}

function TouchStep({ onNext }: { onNext: () => void }) {
  const { t } = useI18n();
  const draft = useStoryStore((s) => s.draft);
  const update = useStoryStore((s) => s.update);
  const s = t.studio.adventure;
  const tooLong = draft.customIdea.length > TEXT_LIMITS.idea || draft.dedication.length > TEXT_LIMITS.dedication;

  return (
    <StepFrame
      kicker={s.kicker}
      title={s.touchTitle}
      onSubmit={(e) => {
        e.preventDefault();
        if (!tooLong) onNext();
      }}
    >
      <div className="space-y-7">
        <div>
          <Label htmlFor="idea" optional>
            {s.idea}
          </Label>
          <TextArea id="idea" value={draft.customIdea} maxLength={TEXT_LIMITS.idea} placeholder={s.ideaPlaceholder} aria-describedby="idea-help" onChange={(e) => update({ customIdea: e.target.value })} />
          <div className="mt-2 flex justify-between gap-4 text-[0.82rem] text-ink-muted">
            <p id="idea-help">{s.ideaHelp}</p>
            <span className="shrink-0 tabular-nums">{s.chars(draft.customIdea.length, TEXT_LIMITS.idea)}</span>
          </div>
        </div>
        <div>
          <Label htmlFor="dedication" optional>
            {s.dedication}
          </Label>
          <TextArea id="dedication" value={draft.dedication} maxLength={TEXT_LIMITS.dedication} placeholder={s.dedicationPlaceholder} className="font-display text-lg italic" onChange={(e) => update({ dedication: e.target.value })} />
          <p className="mt-2 text-end text-[0.82rem] text-ink-muted tabular-nums">{s.chars(draft.dedication.length, TEXT_LIMITS.dedication)}</p>
        </div>
      </div>
    </StepFrame>
  );
}
