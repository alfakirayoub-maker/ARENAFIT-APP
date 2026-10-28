'use client';

import { useId, type ReactNode } from 'react';

import { WORLD_CATALOG } from '@/config/catalog';
import type { SceneMoment, WorldId } from '@/lib/engine/types';

import { ChildFigure, CompanionFigure, Creature } from './characters';

/**
 * Layered SVG illustration for a world and story moment.
 *
 * PROVISIONAL ART: these compositions stand in for original illustrations.
 * To ship real artwork, add an image per world/moment and render it here
 * instead (keep the 4:3 frame so book layouts don't move).
 */
export interface WorldSceneProps {
  world: WorldId;
  moment?: SceneMoment;
  /** Show the hero (and companion/creature, depending on the moment). */
  characters?: boolean;
  companion?: boolean;
  className?: string;
  /** Twinkle/float animations (disabled automatically for reduced motion via CSS). */
  animated?: boolean;
  title?: string;
}

export function WorldScene({ world, moment = 'arrival', characters = true, companion = false, className, animated = true, title }: WorldSceneProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const p = WORLD_CATALOG[world].palette;
  const tw = animated ? 'animate-twinkle' : undefined;
  const Background = BACKGROUNDS[world];

  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={p.glow} stopOpacity="0.95" />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-vignette`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor={p.ink} stopOpacity="0" />
          <stop offset="1" stopColor={p.ink} stopOpacity="0.28" />
        </linearGradient>
      </defs>
      <Background uid={uid} tw={tw} />
      {characters && <Cast world={world} moment={moment} companion={companion} uid={uid} tw={tw} />}
      <rect width="400" height="300" fill={`url(#${uid}-vignette)`} />
    </svg>
  );
}

type BgProps = { uid: string; tw?: string };

function Sparkle({ x, y, r = 2, fill, className, delay = 0 }: { x: number; y: number; r?: number; fill: string; className?: string; delay?: number }) {
  return (
    <path
      d={`M${x} ${y - r * 2} L${x + r * 0.5} ${y - r * 0.5} L${x + r * 2} ${y} L${x + r * 0.5} ${y + r * 0.5} L${x} ${y + r * 2} L${x - r * 0.5} ${y + r * 0.5} L${x - r * 2} ${y} L${x - r * 0.5} ${y - r * 0.5} Z`}
      fill={fill}
      className={className}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    />
  );
}

/** Rounds trig output so server and browser serialise identical attributes. */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Deterministic pseudo-random points (no Math.random → identical server/client markup). */
function points(seed: number, n: number, w = 400, h = 180) {
  const out: [number, number, number][] = [];
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) out.push([Math.round(rnd() * w), Math.round(rnd() * h), rnd()]);
  return out;
}

function Forest({ uid, tw }: BgProps) {
  const p = WORLD_CATALOG['enchanted-forest'].palette;
  return (
    <>
      <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#bcb2e6" />
        <stop offset="0.65" stopColor={p.skyLow} />
      </linearGradient>
      <rect width="400" height="300" fill={`url(#${uid}-sky)`} />
      <circle cx="292" cy="78" r="70" fill={`url(#${uid}-glow)`} />
      <circle cx="292" cy="78" r="22" fill="#fff6dc" />
      <path d="M0 180 C40 150 80 160 120 140 C160 120 200 150 240 135 C290 115 340 140 400 125 L400 300 L0 300 Z" fill="#7d8fa0" opacity="0.35" />
      <path d="M0 205 C50 180 90 195 140 178 C190 160 230 190 280 176 C330 160 360 180 400 170 L400 300 L0 300 Z" fill="#5f7a6a" opacity="0.6" />
      {/* tall trunks framing the scene */}
      {[
        [26, 12],
        [64, 8],
        [334, 10],
        [372, 14],
      ].map(([x, w], i) => (
        <g key={i}>
          <path d={`M${x - w / 2} 300 L${x - w / 3} 40 L${x + w / 3} 40 L${x + w / 2} 300 Z`} fill="#2c3d38" />
          <ellipse cx={x} cy={52 + (i % 2) * 14} rx={44 - i * 2} ry={38} fill="#3c5a4c" />
          <ellipse cx={x + 16} cy={78 + (i % 2) * 10} rx={30} ry={26} fill="#4f6b55" />
        </g>
      ))}
      <path d="M0 238 C80 225 140 232 200 228 C270 224 330 232 400 226 L400 300 L0 300 Z" fill={p.ground} />
      <path d="M0 262 C90 252 160 258 220 254 C300 250 350 258 400 254 L400 300 L0 300 Z" fill="#3b5546" />
      {/* ferns */}
      {[40, 96, 300, 356].map((x, i) => (
        <path key={x} d={`M${x} 268 C${x - 10} 250 ${x - 22} 246 ${x - 30} 244 M${x} 268 C${x + 8} 248 ${x + 18} 244 ${x + 28} 242 M${x} 268 C${x} 250 ${x + 2} 240 ${x - 2} 232`} stroke={i % 2 ? '#6f8f6a' : '#86a77f'} strokeWidth="3" fill="none" strokeLinecap="round" />
      ))}
      {/* mushrooms */}
      <g>
        <rect x="266" y="246" width="4" height="10" rx="2" fill="#f4efe3" />
        <path d="M259 248 C259 238 277 238 277 248 Z" fill="#efaf9d" />
        <rect x="282" y="250" width="3" height="7" rx="1.5" fill="#f4efe3" />
        <path d="M277 252 C277 245 290 245 290 252 Z" fill="#e8bc75" />
      </g>
      {points(7, 16, 400, 150).map(([x, y], i) => (
        <circle key={i} cx={x} cy={110 + y * 0.8} r={1.6 + (i % 3) * 0.6} fill="#ffe7a3" className={tw} style={{ animationDelay: `${(i % 7) * 0.45}s` }} />
      ))}
    </>
  );
}

function Space({ uid, tw }: BgProps) {
  const p = WORLD_CATALOG.space.palette;
  return (
    <>
      <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={p.sky} />
        <stop offset="0.85" stopColor={p.skyLow} />
      </linearGradient>
      <radialGradient id={`${uid}-planet`} cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#f7cdbf" />
        <stop offset="1" stopColor="#c97f6b" />
      </radialGradient>
      <rect width="400" height="300" fill={`url(#${uid}-sky)`} />
      {points(3, 60, 400, 220).map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={0.6 + r * 1.3} fill="#faf7f0" opacity={0.4 + r * 0.6} className={i % 4 === 0 ? tw : undefined} style={{ animationDelay: `${(i % 9) * 0.35}s` }} />
      ))}
      <circle cx="292" cy="86" r="80" fill={`url(#${uid}-glow)`} opacity="0.35" />
      <ellipse cx="292" cy="86" rx="62" ry="14" fill="none" stroke="#dcd6f7" strokeWidth="3" opacity="0.55" transform="rotate(-14 292 86)" />
      <circle cx="292" cy="86" r="32" fill={`url(#${uid}-planet)`} />
      <path d="M232 98 C260 108 320 88 350 72" stroke="#dcd6f7" strokeWidth="3" fill="none" opacity="0.85" transform="rotate(-2 292 86)" />
      <circle cx="78" cy="62" r="11" fill="#dcd6f7" opacity="0.9" />
      <path d="M120 40 L176 72" stroke="#faf7f0" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
      <circle cx="178" cy="73" r="2.6" fill="#fff1cc" />
      {/* milk-white moon surface */}
      <path d="M-20 300 L-20 236 C60 206 150 214 220 220 C300 226 360 210 420 222 L420 300 Z" fill="#e9e5f6" />
      <path d="M-20 300 L-20 262 C80 246 170 254 240 252 C320 250 370 246 420 252 L420 300 Z" fill="#d4cfea" />
      <ellipse cx="88" cy="244" rx="20" ry="5" fill="#c4bee0" />
      <ellipse cx="318" cy="238" rx="14" ry="4" fill="#c4bee0" />
      <ellipse cx="250" cy="270" rx="26" ry="6" fill="#bdb6db" />
      {/* paper rocket */}
      <g transform="translate(338 214) rotate(8)">
        <path d="M0 -26 C8 -16 8 -4 6 4 L-6 4 C-8 -4 -8 -16 0 -26 Z" fill="#faf7f0" />
        <circle cx="0" cy="-10" r="3" fill="#efaf9d" />
        <path d="M-6 0 L-11 8 L-5 5 Z M6 0 L11 8 L5 5 Z" fill="#efaf9d" />
      </g>
    </>
  );
}

function Ocean({ uid, tw }: BgProps) {
  const p = WORLD_CATALOG.ocean.palette;
  return (
    <>
      <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#9cc9bf" />
        <stop offset="0.75" stopColor={p.sky} />
      </linearGradient>
      <rect width="400" height="300" fill={`url(#${uid}-sky)`} />
      {[60, 150, 250, 330].map((x, i) => (
        <path key={x} d={`M${x} 0 L${x + 30} 0 L${x + 70 - i * 5} 300 L${x - 10} 300 Z`} fill="#faf7f0" opacity="0.07" />
      ))}
      {/* distant pearl palace */}
      <g fill="#2f6470" opacity="0.55">
        <rect x="244" y="122" width="62" height="60" />
        <path d="M244 122 C244 98 306 98 306 122 Z" />
        <rect x="230" y="134" width="14" height="48" />
        <path d="M230 134 L237 112 L244 134 Z" />
        <rect x="306" y="134" width="14" height="48" />
        <path d="M306 134 L313 112 L320 134 Z" />
      </g>
      <circle cx="275" cy="108" r="40" fill={`url(#${uid}-glow)`} opacity="0.35" />
      <path d="M0 230 C80 214 150 226 220 220 C300 212 350 224 400 216 L400 300 L0 300 Z" fill="#e7d7b4" opacity="0.75" />
      <path d="M0 256 C100 244 170 254 240 250 C310 246 360 252 400 248 L400 300 L0 300 Z" fill="#d9c49b" opacity="0.85" />
      {/* coral */}
      {[
        [48, '#efaf9d'],
        [86, '#e8bc75'],
        [328, '#efaf9d'],
        [364, '#dcd6f7'],
      ].map(([x, c], i) => (
        <path key={i} d={`M${x} 262 L${x} 236 M${x} 248 L${(x as number) - 12} 230 M${x} 244 L${(x as number) + 12} 222 M${(x as number) - 12} 230 L${(x as number) - 16} 220 M${(x as number) + 12} 222 L${(x as number) + 18} 214`} stroke={c as string} strokeWidth="5" strokeLinecap="round" fill="none" />
      ))}
      {/* seaweed */}
      {[24, 120, 300, 390].map((x) => (
        <path key={x} d={`M${x} 270 C${x - 10} 240 ${x + 10} 220 ${x} 190 C${x - 8} 172 ${x + 6} 160 ${x} 146`} stroke="#3e6b5a" strokeWidth="5" fill="none" strokeLinecap="round" />
      ))}
      {points(11, 18, 400, 200).map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y + 20} r={1.5 + r * 3} fill="none" stroke="#faf7f0" strokeWidth="1" opacity="0.6" className={i % 3 === 0 ? tw : undefined} style={{ animationDelay: `${(i % 6) * 0.5}s` }} />
      ))}
      {/* small fish */}
      {[
        [120, 96],
        [140, 108],
        [190, 74],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} c6 -5 14 -5 18 0 c-4 5 -12 5 -18 0 Z M${x} ${y} l-6 -4 l0 8 Z`} fill={i === 2 ? '#e8bc75' : '#efaf9d'} />
      ))}
    </>
  );
}

function Dino({ uid, tw }: BgProps) {
  const p = WORLD_CATALOG['dinosaur-valley'].palette;
  return (
    <>
      <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#efc183" />
        <stop offset="0.7" stopColor={p.skyLow} />
      </linearGradient>
      <rect width="400" height="300" fill={`url(#${uid}-sky)`} />
      <circle cx="108" cy="92" r="80" fill={`url(#${uid}-glow)`} />
      <circle cx="108" cy="92" r="26" fill="#fff3d6" />
      {/* sleepy volcano */}
      <path d="M232 178 L280 104 L300 104 L350 178 Z" fill="#b98c6a" opacity="0.75" />
      <path d="M280 104 C284 112 296 112 300 104 Z" fill="#b4563d" />
      <circle cx="292" cy="86" r="9" fill="#faf7f0" opacity="0.7" className={tw} />
      <circle cx="302" cy="70" r="12" fill="#faf7f0" opacity="0.55" className={tw} style={{ animationDelay: '1s' }} />
      <circle cx="316" cy="52" r="15" fill="#faf7f0" opacity="0.4" className={tw} style={{ animationDelay: '2s' }} />
      <path d="M0 190 C60 168 120 176 180 166 C240 156 300 176 400 160 L400 300 L0 300 Z" fill="#a6b07a" opacity="0.7" />
      {/* long-neck dinosaur on the hill */}
      <g fill="#6c7448" opacity="0.8">
        <ellipse cx="170" cy="168" rx="26" ry="11" />
        <path d="M188 164 C202 150 206 128 214 118 C218 114 224 116 222 122 C214 132 208 152 196 170 Z" />
        <path d="M146 168 C134 170 126 176 118 178 C128 172 136 166 146 164 Z" />
        <rect x="156" y="172" width="6" height="12" rx="2" />
        <rect x="178" y="172" width="6" height="12" rx="2" />
      </g>
      <path d="M0 232 C70 216 140 226 210 220 C290 212 340 224 400 216 L400 300 L0 300 Z" fill={p.ground} />
      <path d="M0 262 C100 250 170 258 240 254 C310 250 360 256 400 252 L400 300 L0 300 Z" fill="#5f6d3e" />
      {/* giant fern fronds */}
      {[
        [30, -1],
        [380, 1],
      ].map(([x, dir]) => (
        <g key={x} stroke="#4d5a31" strokeWidth="4" fill="none" strokeLinecap="round">
          <path d={`M${x} 290 C${x + dir * 10} 230 ${x + dir * 34} 190 ${x + dir * 70} 170`} />
          {[0, 1, 2, 3, 4].map((k) => (
            <path key={k} d={`M${x + dir * (8 + k * 12)} ${266 - k * 22} l${dir * 18} ${-14 + k}`} />
          ))}
        </g>
      ))}
    </>
  );
}

function Garden({ uid, tw }: BgProps) {
  const p = WORLD_CATALOG['secret-garden'].palette;
  return (
    <>
      <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#dbe8d4" />
        <stop offset="0.7" stopColor={p.skyLow} />
      </linearGradient>
      <rect width="400" height="300" fill={`url(#${uid}-sky)`} />
      <circle cx="320" cy="60" r="70" fill={`url(#${uid}-glow)`} />
      {/* ivy-covered wall with the little arched door */}
      <rect x="0" y="120" width="400" height="120" fill="#d9c7a8" />
      {Array.from({ length: 6 }).map((_, row) =>
        Array.from({ length: 11 }).map((__, col) => (
          <rect key={`${row}-${col}`} x={col * 38 - (row % 2) * 19} y={122 + row * 20} width="36" height="18" rx="2" fill="#cdb894" opacity="0.6" />
        )),
      )}
      <path d="M176 240 L176 176 C176 150 224 150 224 176 L224 240 Z" fill="#8a5a3c" />
      <path d="M182 240 L182 178 C182 158 218 158 218 178 L218 240 Z" fill="#fff5dc" opacity="0.92" />
      <circle cx="200" cy="200" r="46" fill={`url(#${uid}-glow)`} opacity="0.8" />
      {[
        [20, 130, 40],
        [90, 118, 30],
        [150, 124, 26],
        [258, 120, 30],
        [330, 128, 36],
        [390, 122, 28],
      ].map(([x, y, r], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={r} ry={r * 0.7} fill="#6f9168" />
          <ellipse cx={x + 10} cy={y + 14} rx={r * 0.7} ry={r * 0.5} fill="#86a77f" />
        </g>
      ))}
      <path d="M0 236 C80 228 150 234 200 232 C260 230 330 236 400 230 L400 300 L0 300 Z" fill={p.ground} />
      <path d="M0 262 C90 254 170 260 230 257 C300 254 350 260 400 256 L400 300 L0 300 Z" fill="#6d9066" />
      {/* roses and forget-me-nots */}
      {points(5, 22, 400, 40).map(([x, y], i) => (
        <circle key={i} cx={x} cy={232 + y * 0.9} r={3 + (i % 3)} fill={['#efaf9d', '#dcd6f7', '#e8bc75', '#faf7f0'][i % 4]} />
      ))}
      {[
        [96, 104],
        [300, 92],
      ].map(([x, y], i) => (
        <g key={i} className={tw} style={{ animationDelay: `${i * 1.2}s` }}>
          <ellipse cx={x - 4} cy={y} rx="5" ry="3.4" fill="#efaf9d" transform={`rotate(-30 ${x - 4} ${y})`} />
          <ellipse cx={x + 4} cy={y} rx="5" ry="3.4" fill="#efaf9d" transform={`rotate(30 ${x + 4} ${y})`} />
        </g>
      ))}
    </>
  );
}

function Castle({ uid, tw }: BgProps) {
  const p = WORLD_CATALOG['magic-castle'].palette;
  return (
    <>
      <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a99fde" />
        <stop offset="0.7" stopColor={p.skyLow} />
      </linearGradient>
      <rect width="400" height="300" fill={`url(#${uid}-sky)`} />
      {points(9, 18, 400, 90).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={0.8 + (i % 3) * 0.5} fill="#faf7f0" className={i % 3 === 0 ? tw : undefined} opacity="0.8" style={{ animationDelay: `${(i % 5) * 0.6}s` }} />
      ))}
      <circle cx="96" cy="170" r="90" fill={`url(#${uid}-glow)`} />
      <ellipse cx="80" cy="120" rx="60" ry="12" fill="#faf7f0" opacity="0.5" />
      <ellipse cx="320" cy="96" rx="50" ry="10" fill="#faf7f0" opacity="0.45" />
      <path d="M0 214 C70 170 150 150 220 156 C300 162 350 190 400 200 L400 300 L0 300 Z" fill="#8f84c8" />
      {/* castle */}
      <g fill="#3d3570">
        <rect x="196" y="98" width="70" height="66" />
        <rect x="182" y="78" width="18" height="86" />
        <path d="M180 80 L191 44 L202 80 Z" />
        <rect x="262" y="70" width="18" height="94" />
        <path d="M260 72 L271 30 L282 72 Z" />
        <rect x="218" y="62" width="26" height="40" />
        <path d="M215 64 L231 20 L247 64 Z" />
        <path d="M218 164 L218 140 C218 128 244 128 244 140 L244 164 Z" fill="#2a244f" />
      </g>
      <path d="M271 30 L271 18 L284 22 L271 26" fill="#efaf9d" />
      <path d="M231 20 L231 8 L244 12 L231 16" fill="#e8bc75" />
      {[
        [190, 100],
        [271, 96],
        [231, 80],
        [208, 118],
        [252, 118],
      ].map(([x, y], i) => (
        <rect key={i} x={x - 3} y={y} width="6" height="9" rx="3" fill="#ffd98e" />
      ))}
      <path d="M0 240 C80 222 160 230 230 226 C300 222 350 230 400 226 L400 300 L0 300 Z" fill={p.ground} />
      <path d="M0 266 C90 256 170 262 240 258 C310 254 360 260 400 256 L400 300 L0 300 Z" fill="#544a94" />
      {/* floating lanterns */}
      {[
        [60, 70],
        [120, 46],
        [330, 140],
        [356, 60],
        [150, 120],
      ].map(([x, y], i) => (
        <g key={i} className="animate-float-soft" style={{ animationDelay: `${i * 0.8}s` }}>
          <circle cx={x} cy={y} r="12" fill="#ffd98e" opacity="0.25" />
          <rect x={x - 4} y={y - 6} width="8" height="11" rx="3" fill="#e8bc75" />
        </g>
      ))}
    </>
  );
}

const BACKGROUNDS: Record<WorldId, (p: BgProps) => ReactNode> = {
  'enchanted-forest': Forest,
  space: Space,
  ocean: Ocean,
  'dinosaur-valley': Dino,
  'secret-garden': Garden,
  'magic-castle': Castle,
};

/** Where characters stand, and what magic surrounds them, for each story moment. */
function Cast({ world, moment, companion, uid, tw }: { world: WorldId; moment: SceneMoment; companion: boolean; uid: string; tw?: string }) {
  const p = WORLD_CATALOG[world].palette;
  const ground = world === 'space' ? 250 : world === 'ocean' ? 252 : 256;
  const ink = p.ink;
  const creature = moment !== 'arrival';
  const childX = moment === 'arrival' ? 150 : 180;

  return (
    <g>
      {moment === 'triumph' && (
        <g opacity="0.85">
          <circle cx="200" cy={ground - 40} r="110" fill={`url(#${uid}-glow)`} />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <line key={i} x1={r2(200 + Math.cos(a) * 40)} y1={r2(ground - 40 + Math.sin(a) * 40)} x2={r2(200 + Math.cos(a) * 80)} y2={r2(ground - 40 + Math.sin(a) * 80)} stroke={p.glow} strokeWidth="2" strokeLinecap="round" opacity="0.6" />;
          })}
        </g>
      )}
      {moment === 'challenge' && (
        <g>
          <circle cx="280" cy={ground - 40} r="60" fill={`url(#${uid}-glow)`} />
          <path d={`M262 ${ground} L262 ${ground - 52} C262 ${ground - 78} 298 ${ground - 78} 298 ${ground - 52} L298 ${ground} Z`} fill={p.accent} opacity="0.95" />
          <circle cx="280" cy={ground - 36} r="4" fill={ink} />
          <path d={`M278 ${ground - 34} L276 ${ground - 22} L284 ${ground - 22} L282 ${ground - 34} Z`} fill={ink} />
        </g>
      )}
      {moment === 'learning' && (
        <g>
          <circle cx="200" cy={ground - 70} r="54" fill={`url(#${uid}-glow)`} opacity="0.9" />
          {[0, 1, 2, 3, 4].map((i) => {
            const a = Math.PI + (i / 4) * Math.PI;
            return <circle key={i} cx={r2(200 + Math.cos(a) * 48)} cy={r2(ground - 64 + Math.sin(a) * 34)} r="6" fill={['#efaf9d', '#e8bc75', '#c5d8c0', '#dcd6f7', '#faf7f0'][i]} className={tw} style={{ animationDelay: `${i * 0.4}s` }} />;
          })}
        </g>
      )}
      <ellipse cx={childX + (companion ? -14 : 0)} cy={ground + 2} rx={companion ? 46 : 24} ry="4" fill={ink} opacity="0.18" />
      {companion && <CompanionFigure ink={ink} x={childX - 30} y={ground} s={1.05} />}
      <ChildFigure ink={ink} x={childX} y={ground} s={1.1} />
      {creature && <Creature world={world} ink={ink} accent={world === 'space' || world === 'magic-castle' ? '#efaf9d' : world === 'secret-garden' ? '#e8bc75' : p.accent} x={236} y={world === 'secret-garden' ? ground - 24 : ground} s={1.1} />}
      {(moment === 'meeting' || moment === 'triumph') &&
        [
          [222, ground - 60],
          [252, ground - 48],
          [160, ground - 70],
        ].map(([x, y], i) => <Sparkle key={i} x={x} y={y} r={2.2} fill={p.glow} className={tw} delay={i * 0.6} />)}
    </g>
  );
}
