'use client';

import { motion, useReducedMotion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef } from 'react';

import { WorldScene } from '@/art/WorldScene';

/**
 * Hero illustration: an open hardcover lying in perspective, with a castle
 * world rising out of its gutter. Pointer parallax on desktop only; static
 * under reduced motion.
 */
export function HeroBook({ name, title, kicker, rtl }: { name: string; title: string; kicker: string; rtl: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });
  const far = { x: useTransform(sx, (v) => v * -10), y: useTransform(sy, (v) => v * -6) };
  const near = { x: useTransform(sx, (v) => v * 18), y: useTransform(sy, (v) => v * 10) };
  const tilt = useTransform(sx, (v) => v * 3);

  useEffect(() => {
    if (reduce || !window.matchMedia('(pointer: fine)').matches) return;
    const onMove = (e: PointerEvent) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
      my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [reduce, mx, my]);

  const rise = reduce ? false : { opacity: 0, y: 40, scale: 0.94 };

  return (
    <div ref={ref} className="relative mx-auto aspect-[10/11] w-full max-w-[560px] select-none" aria-hidden>
      {/* warm halo */}
      <div className="absolute inset-[6%] rounded-full bg-[radial-gradient(closest-side,rgb(232_188_117/0.45),transparent)]" />

      {/* the world, rising from the pages (arched like a pop-up page) */}
      <motion.div
        className="absolute inset-x-[13%] top-[3%] bottom-[34%] overflow-hidden rounded-t-[999px]"
        style={{ x: far.x, y: far.y, maskImage: 'linear-gradient(180deg,#000 72%,transparent 99%)', WebkitMaskImage: 'linear-gradient(180deg,#000 72%,transparent 99%)' }}
        initial={rise}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.1, delay: 0.35, ease: [0.22, 0.8, 0.24, 1] }}
      >
        <WorldScene world="magic-castle" moment="triumph" className="size-full" />
        <div className="absolute inset-0 rounded-t-[999px] ring-1 ring-gold/50 ring-inset" />
      </motion.div>

      {/* the open book, lying in perspective */}
      <div className="absolute inset-x-0 bottom-[3%] h-[44%]" style={{ perspective: '1100px' }}>
        <motion.div
          className="preserve-3d absolute inset-x-[2%] bottom-0 h-full"
          style={{ rotateX: 52, rotateZ: tilt }}
          initial={reduce ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 0.8, 0.24, 1] }}
        >
          {/* hard cover peeking out under the pages */}
          <div className="absolute -inset-x-[2.5%] -inset-y-[4%] rounded-2xl bg-[#3d3570] shadow-[0_40px_60px_-20px_rgb(32_38_61/0.55)]" />
          <Page side={rtl ? 'right' : 'left'}>
            <p className="font-display text-[clamp(0.7rem,2.2vw,1.05rem)] text-ink-muted italic">{kicker}</p>
            <p className="font-display mt-1 text-[clamp(1.1rem,4vw,2rem)] leading-none text-ink">{name}</p>
            <Lines n={4} />
          </Page>
          <Page side={rtl ? 'left' : 'right'}>
            <p className="font-display text-[clamp(0.65rem,2vw,0.95rem)] leading-tight text-ink">{title}</p>
            <Lines n={5} />
          </Page>
          {/* gutter shadow */}
          <div className="absolute inset-y-0 left-1/2 w-[8%] -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgb(32_38_61/0.22),transparent)]" />
        </motion.div>
      </div>

      {/* foreground magic: lanterns and sparkles drifting out of the book */}
      <motion.div className="pointer-events-none absolute inset-0" style={{ x: near.x, y: near.y }}>
        {[
          ['8%', '30%', 0],
          ['86%', '22%', 1.2],
          ['78%', '52%', 0.6],
          ['16%', '58%', 1.8],
        ].map(([left, top, delay], i) => (
          <span key={i} className="animate-float-soft absolute block" style={{ left: left as string, top: top as string, animationDelay: `${delay}s` }}>
            <span className="block size-7 rounded-full bg-gold/30 blur-[6px]" />
            <span className="absolute inset-x-2 top-1.5 bottom-1.5 rounded-md bg-gold shadow-[0_0_14px_rgb(232_188_117/0.9)]" />
          </span>
        ))}
        {[
          ['30%', '12%'],
          ['70%', '8%'],
          ['50%', '62%'],
          ['92%', '40%'],
          ['4%', '44%'],
        ].map(([left, top], i) => (
          <svg key={i} viewBox="0 0 20 20" className="animate-twinkle absolute size-4" style={{ left, top, animationDelay: `${i * 0.5}s` }}>
            <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill="#e8bc75" />
          </svg>
        ))}
      </motion.div>
    </div>
  );
}

function Page({ side, children }: { side: 'left' | 'right'; children: React.ReactNode }) {
  const left = side === 'left';
  return (
    <div
      className={`absolute top-0 bottom-0 w-1/2 overflow-hidden px-[6%] pt-[7%] ${left ? 'left-0 rounded-l-xl text-start' : 'right-0 rounded-r-xl text-start'}`}
      style={{
        background: left ? 'linear-gradient(90deg,#f4efe3,#faf7f0 70%,#e9e1cc)' : 'linear-gradient(270deg,#f4efe3,#faf7f0 70%,#e9e1cc)',
        transformOrigin: left ? 'right center' : 'left center',
        transform: `rotateY(${left ? 6 : -6}deg)`,
      }}
    >
      {children}
    </div>
  );
}

function Lines({ n }: { n: number }) {
  return (
    <div className="mt-[6%] flex flex-col gap-[0.45em]">
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className="block h-[3px] rounded-full bg-ink/12" style={{ width: `${92 - ((i * 17) % 30)}%` }} />
      ))}
    </div>
  );
}
