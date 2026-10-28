'use client';

import { useState } from 'react';

import { WorldScene } from '@/art/WorldScene';
import { useI18n } from '@/i18n/client';
import { WORLDS } from '@/lib/engine/types';
import { useStoryStore } from '@/store/story';

import { ChoiceTile, FieldError } from '../fields';
import { StepFrame } from '../StepFrame';

export function WorldStep({ onNext }: { sub: number; onNext: () => void }) {
  const { t } = useI18n();
  const world = useStoryStore((s) => s.draft.world);
  const update = useStoryStore((s) => s.update);
  const [tried, setTried] = useState(false);
  const s = t.studio.world;

  return (
    <StepFrame
      kicker={s.kicker}
      title={s.title}
      help={s.help}
      wide
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (world) onNext();
      }}
    >
      <fieldset>
        <legend className="sr-only">{s.title}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {WORLDS.map((w) => (
            <ChoiceTile key={w} name="world" value={w} checked={world === w} onSelect={() => update({ world: w })}>
              <span className="flex w-full flex-col overflow-hidden rounded-[1.2rem]">
                <span className="relative block aspect-[4/3] overflow-hidden">
                  <WorldScene world={w} moment="arrival" animated={false} className={`size-full transition-transform duration-700 ${world === w ? 'scale-110' : ''}`} />
                </span>
                <span className="px-3 pt-2.5 pb-3">
                  <span className="font-display block text-[1.05rem] leading-tight sm:text-lg">{t.catalog.worlds[w].name}</span>
                  <span className="mt-0.5 hidden text-[0.8rem] leading-snug text-ink-muted sm:block">{t.catalog.worlds[w].tagline}</span>
                </span>
              </span>
            </ChoiceTile>
          ))}
        </div>
        <FieldError>{tried && !world ? t.studio.errors.choose : undefined}</FieldError>
      </fieldset>
    </StepFrame>
  );
}
