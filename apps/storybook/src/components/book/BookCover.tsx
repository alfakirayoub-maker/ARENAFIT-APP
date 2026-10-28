'use client';

/* eslint-disable @next/next/no-img-element -- local data-URL photos, never optimised by next/image */
import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';

import { WorldScene } from '@/art/WorldScene';
import { WORLD_CATALOG } from '@/config/catalog';
import type { LocalPhoto, WorldId } from '@/lib/engine/types';

export interface BookCoverProps {
  title: string;
  name: string;
  world: WorldId;
  eyebrow?: string;
  tagline?: string;
  photo?: LocalPhoto;
  photoAlt?: string;
  companion?: boolean;
  /** Arabic books bind on the right. */
  dir?: 'ltr' | 'rtl';
  /** Resting 3D angle; 0 shows the cover flat. */
  angle?: number;
  className?: string;
  /** Lets the reveal animate the book in. */
  entrance?: boolean;
}

/**
 * A hardcover in CSS 3D: front board, spine and page block. All faces are
 * plain divs with transforms — cheap to composite on mid-range phones.
 */
export function BookCover({ title, name, world, eyebrow, tagline, photo, photoAlt, companion, dir = 'ltr', angle = 24, className = '', entrance = false }: BookCoverProps) {
  const reduce = useReducedMotion();
  const p = WORLD_CATALOG[world].palette;
  const rtl = dir === 'rtl';
  // Positive rotateY brings the left edge forward, showing the spine of a left-bound book.
  const turn = rtl ? -angle : angle;
  const style = { '--thick': '22px', '--cover': p.cover } as CSSProperties;

  return (
    <div className={`relative ${className}`} style={{ perspective: '1800px' }}>
      <motion.div
        className="preserve-3d relative aspect-square w-full"
        style={style}
        initial={entrance && !reduce ? { rotateY: turn * 2.4, rotateX: 14, y: 30, opacity: 0 } : false}
        animate={{ rotateY: turn, rotateX: 6, y: 0, opacity: 1 }}
        whileHover={reduce ? undefined : { rotateY: turn * 0.55, rotateX: 3 }}
        transition={{ type: 'spring', stiffness: 60, damping: 16 }}
      >
        {/* page block, seen on the opening edge */}
        <div
          className="absolute inset-y-[1.6%] w-[var(--thick)] rounded-sm"
          style={{
            [rtl ? 'left' : 'right']: 0,
            transform: `translateX(${rtl ? '-50%' : '50%'}) translateZ(calc(var(--thick) / -2)) rotateY(${rtl ? '-90deg' : '90deg'})`,
            background: 'repeating-linear-gradient(90deg, #f4efe3 0 1.5px, #e3dac4 1.5px 3px)',
          }}
        />
        {/* back board (gives thickness at the edges) */}
        <div className="absolute inset-0 rounded-[6px_14px_14px_6px] shadow-[var(--shadow-book)]" style={{ background: p.cover, transform: 'translateZ(calc(var(--thick) * -1))' }} />
        {/* spine */}
        <div
          className="absolute inset-y-0 w-[var(--thick)]"
          style={{
            [rtl ? 'right' : 'left']: 0,
            transform: `translateX(${rtl ? '50%' : '-50%'}) translateZ(calc(var(--thick) / -2)) rotateY(${rtl ? '90deg' : '-90deg'})`,
            background: `linear-gradient(90deg, rgb(0 0 0 / 0.35), transparent 40%, rgb(255 255 255 / 0.12) 60%, rgb(0 0 0 / 0.3)), ${p.cover}`,
          }}
        />
        {/* front board */}
        <div
          className={`grain backface-hidden @container absolute inset-0 overflow-hidden ${rtl ? 'rounded-[14px_6px_6px_14px]' : 'rounded-[6px_14px_14px_6px]'}`}
          style={{ background: p.cover, transform: 'translateZ(0.5px)' }}
        >
          <WorldScene world={world} moment="arrival" companion={companion} className="absolute inset-0 size-full" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${p.cover}f2 0%, ${p.cover}b0 30%, transparent 58%)` }} />
          {/* hinge groove */}
          <div className="absolute inset-y-0 w-[7%]" style={{ [rtl ? 'right' : 'left']: 0, background: `linear-gradient(${rtl ? '270deg' : '90deg'}, rgb(0 0 0 / 0.32), rgb(255 255 255 / 0.1) 40%, transparent)` }} />
          <div className="absolute inset-[5%] rounded-[4px] ring-1 ring-gold/40" />
          <div dir={dir} className="absolute inset-x-[10%] top-[9%] text-center">
            {eyebrow && <p className="text-[clamp(0.5rem,2.4cqw,0.75rem)] font-medium tracking-[0.22em] text-gold/90 uppercase">{eyebrow}</p>}
            <h3 className="font-display foil mt-[3%] text-[clamp(1rem,7.2cqw,2.6rem)] leading-[1.05] font-semibold text-balance">{title}</h3>
            {tagline && <p className="mt-[3%] text-[clamp(0.55rem,2.8cqw,0.9rem)] text-ivory/85 italic">{tagline}</p>}
          </div>
          {photo && (
            <div className="absolute bottom-[8%] w-[22%]" style={{ [rtl ? 'left' : 'right']: '8%' }}>
              <div className="aspect-[4/5] overflow-hidden rounded-[50%] p-[5%] shadow-lg" style={{ background: 'linear-gradient(135deg,#f6dfa9,#c99442,#f1d08e)' }}>
                <img src={photo.dataUrl} alt={photoAlt ?? name} className="size-full rounded-[50%] object-cover" />
              </div>
            </div>
          )}
        </div>
      </motion.div>
      {/* contact shadow */}
      <div className="absolute inset-x-[8%] -bottom-[6%] h-[10%] rounded-[50%] bg-ink/25 blur-xl" aria-hidden />
    </div>
  );
}
