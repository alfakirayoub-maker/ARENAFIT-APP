type Variant = 'primary' | 'secondary' | 'ghost' | 'gold';
type Size = 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-[0.01em] transition-[transform,background-color,box-shadow,color] duration-200 ease-[var(--ease-page)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 select-none';

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-ivory shadow-[0_10px_24px_-12px_rgb(32_38_61/0.7)] hover:bg-ink-soft hover:-translate-y-0.5',
  gold: 'bg-gold text-ink shadow-[0_10px_24px_-12px_rgb(154_106_31/0.8)] hover:bg-[#efc88a] hover:-translate-y-0.5',
  secondary: 'bg-ivory/70 text-ink ring-1 ring-ink/15 backdrop-blur hover:bg-ivory hover:ring-ink/30',
  ghost: 'text-ink hover:bg-ink/5',
};

const sizes: Record<Size, string> = {
  md: 'min-h-11 px-5 text-[0.95rem]',
  lg: 'min-h-14 px-7 text-base sm:text-[1.05rem]',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}
