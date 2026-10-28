'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Gentle fade-and-rise when a block enters the viewport.
 * CSS-driven: content is only hidden once JS is known to run (`html.js`), and
 * never under prefers-reduced-motion — so nothing can stay invisible.
 */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add('is-visible');
        io.disconnect();
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-reveal className={className} style={delay ? { transitionDelay: `${delay}s` } : undefined}>
      {children}
    </div>
  );
}
