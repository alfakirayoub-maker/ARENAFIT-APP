import type { WorldId } from '@/lib/engine/types';

/**
 * Storybook silhouettes. Deliberately non-figurative (no skin tone, no facial
 * features) so every family can see themselves; the final illustrated book
 * replaces them with drawn characters.
 */

export function ChildFigure({ ink, scarf = '#efaf9d', lantern = '#e8bc75', x = 0, y = 0, s = 1, flip = false }: FigureProps & { lantern?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      {/* lantern glow */}
      <circle cx="14" cy="-15" r="9" fill={lantern} opacity="0.28" />
      <line x1="7" y1="-22" x2="13" y2="-18" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <rect x="11" y="-18" width="5" height="6" rx="1.5" fill={lantern} />
      {/* scarf flowing behind */}
      <path d="M-4 -29 C-12 -29 -18 -33 -24 -40 C-20 -30 -14 -25 -5 -24 Z" fill={scarf} />
      {/* body */}
      <path d="M-6.5 -28 C-8.5 -20 -10 -9 -11 0 L-3 0 L-2 -6 L2 -6 L3 0 L11 0 C10 -9 8.5 -20 6.5 -28 Z" fill={ink} />
      {/* head + hair tuft */}
      <circle cx="0" cy="-35" r="7.2" fill={ink} />
      <path d="M-5 -40 C-2 -46 4 -46 6 -41 C3 -43 -1 -43 -5 -40 Z" fill={ink} />
      <path d="M-6 -30 L6 -30 L5 -26 L-5 -26 Z" fill={scarf} />
    </g>
  );
}

export function CompanionFigure({ ink, scarf = '#dcd6f7', x = 0, y = 0, s = 1, flip = false }: FigureProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M-8 -46 C-11 -32 -13 -15 -14 0 L-4 0 L-3 -10 L3 -10 L4 0 L14 0 C13 -15 11 -32 8 -46 Z" fill={ink} />
      {/* arm reaching toward the child */}
      <path d="M7 -40 C14 -34 18 -28 21 -22" stroke={ink} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <circle cx="0" cy="-55" r="8.6" fill={ink} />
      <path d="M-9 -48 C-4 -45 4 -45 9 -48 L9 -44 C4 -41 -4 -41 -9 -44 Z" fill={scarf} />
    </g>
  );
}

interface FigureProps {
  ink: string;
  scarf?: string;
  x?: number;
  y?: number;
  s?: number;
  flip?: boolean;
}

/** Each world's small creature companion, drawn from a few soft shapes. */
export function Creature({ world, ink, accent, x = 0, y = 0, s = 1 }: { world: WorldId; ink: string; accent: string; x?: number; y?: number; s?: number }) {
  const body = (() => {
    switch (world) {
      case 'enchanted-forest': // fox
        return (
          <>
            <path d="M-16 -6 C-30 -10 -32 -24 -22 -26 C-24 -18 -18 -12 -10 -11 Z" fill={accent} />
            <ellipse cx="0" cy="-8" rx="13" ry="8" fill={accent} />
            <path d="M6 -14 L10 -27 L14 -16 L18 -26 L19 -12 C17 -6 9 -6 6 -10 Z" fill={accent} />
            <circle cx="14.5" cy="-14" r="1.4" fill={ink} />
            <path d="M-8 -2 L-8 0 M6 -2 L6 0" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
          </>
        );
      case 'space': // star-robot
        return (
          <>
            <line x1="0" y1="-26" x2="0" y2="-33" stroke={ink} strokeWidth="1.6" />
            <path d="M0 -38 L1.6 -34.6 L5 -34 L2.5 -31.6 L3 -28 L0 -29.8 L-3 -28 L-2.5 -31.6 L-5 -34 L-1.6 -34.6 Z" fill={accent} />
            <rect x="-11" y="-26" width="22" height="18" rx="7" fill="#dcd6f7" />
            <circle cx="-4" cy="-17" r="2" fill={ink} />
            <circle cx="4" cy="-17" r="2" fill={ink} />
            <rect x="-8" y="-7" width="16" height="7" rx="3" fill="#dcd6f7" opacity="0.85" />
          </>
        );
      case 'ocean': // turtle
        return (
          <>
            <path d="M-15 -3 C-15 -16 15 -16 15 -3 Z" fill={accent} />
            <path d="M-8 -8 L0 -13 L8 -8 L0 -4 Z" fill="none" stroke={ink} strokeWidth="1" opacity="0.5" />
            <ellipse cx="19" cy="-6" rx="5.5" ry="4.5" fill="#c5d8c0" />
            <circle cx="21" cy="-7" r="1.1" fill={ink} />
            <path d="M-12 -2 L-17 2 M10 -2 L14 2" stroke="#c5d8c0" strokeWidth="3.5" strokeLinecap="round" />
          </>
        );
      case 'dinosaur-valley': // triceratops
        return (
          <>
            <ellipse cx="-2" cy="-9" rx="15" ry="9" fill={accent} />
            <path d="M-16 -9 C-24 -8 -26 -4 -30 -2 C-24 -3 -20 -4 -15 -5 Z" fill={accent} />
            <path d="M9 -22 C20 -24 22 -12 18 -6 C14 -12 10 -14 9 -22 Z" fill="#e8bc75" />
            <ellipse cx="16" cy="-9" rx="7" ry="5.5" fill={accent} />
            <path d="M19 -13 L25 -18 M15 -14 L18 -21 M22 -8 L27 -8" stroke="#faf7f0" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="17" cy="-10" r="1.1" fill={ink} />
            <path d="M-10 -1 L-10 1 M5 -1 L5 1" stroke={accent} strokeWidth="4" strokeLinecap="round" />
          </>
        );
      case 'secret-garden': // bee
        return (
          <>
            <ellipse cx="-4" cy="-24" rx="7" ry="5" fill="#faf7f0" opacity="0.9" transform="rotate(-25 -4 -24)" />
            <ellipse cx="5" cy="-24" rx="7" ry="5" fill="#faf7f0" opacity="0.9" transform="rotate(25 5 -24)" />
            <ellipse cx="0" cy="-15" rx="11" ry="8" fill="#e8bc75" />
            <path d="M-4 -22.5 L-4 -7.5 M3 -22.8 L3 -7.2" stroke={ink} strokeWidth="2.6" />
            <circle cx="9" cy="-16" r="1.2" fill={ink} />
          </>
        );
      case 'magic-castle': // dragon
        return (
          <>
            <path d="M-4 -16 C-14 -30 -26 -26 -24 -16 C-18 -20 -12 -18 -4 -12 Z" fill="#dcd6f7" opacity="0.95" />
            <path d="M-12 -6 C-20 -4 -24 2 -16 4 C-20 0 -16 -2 -10 -2 Z" fill={accent} />
            <ellipse cx="0" cy="-8" rx="12" ry="8" fill={accent} />
            <ellipse cx="12" cy="-16" rx="7" ry="6" fill={accent} />
            <path d="M10 -22 L9 -27 M14 -22 L16 -27" stroke={accent} strokeWidth="2" strokeLinecap="round" />
            <circle cx="14" cy="-17" r="1.2" fill={ink} />
            <circle cx="22" cy="-15" r="1.6" fill="#e8bc75" />
            <circle cx="26" cy="-18" r="1" fill="#e8bc75" />
          </>
        );
    }
  })();
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{body}</g>;
}
