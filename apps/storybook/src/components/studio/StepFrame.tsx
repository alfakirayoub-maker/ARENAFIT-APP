'use client';

import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';

export const STEP_FORM_ID = 'studio-step';

/**
 * One page of the studio: a kicker, one question, and a form the footer's
 * "Continue" button submits. Focus moves to the question on arrival so
 * keyboard and screen-reader users land where sighted users look.
 */
export function StepFrame({ kicker, title, help, onSubmit, children, wide = false }: { kicker: string; title: string; help?: string; onSubmit: (e: FormEvent) => void; children: ReactNode; wide?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <form id={STEP_FORM_ID} noValidate onSubmit={onSubmit} className={`mx-auto w-full ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
      <p className="font-display text-[1.05rem] text-gold-deep italic">{kicker}</p>
      <h1 ref={heading} tabIndex={-1} className="font-display mt-2 text-[2rem] leading-[1.08] tracking-[-0.02em] text-balance outline-none sm:text-[2.6rem]">
        {title}
      </h1>
      {help && <p className="mt-3 text-[1.02rem] leading-relaxed text-ink-soft">{help}</p>}
      <div className="mt-7">{children}</div>
    </form>
  );
}
