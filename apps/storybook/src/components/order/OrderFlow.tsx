'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleCheck, Info, Lock, Minus, Pencil, Plus, Sparkles, Tablet } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';

import { BookCover } from '@/components/book/BookCover';
import { FieldError, Label, TextArea, TextInput, useErrorText } from '@/components/studio/fields';
import { buttonClass } from '@/components/ui/button';
import { Logo } from '@/components/ui/Logo';
import { BOOK_FORMATS, FORMAT_ORDER, formatPrice, MAX_QUANTITY } from '@/config/products';
import { useI18n } from '@/i18n/client';
import { previewStorybook } from '@/lib/engine';
import type { BookFormatId, Storybook } from '@/lib/engine/types';
import { orderGateway, subtotal } from '@/lib/orders/gateway';
import { deliverySchema, type DeliveryValues } from '@/lib/validation';
import { useHydratedStores } from '@/store/hydration';
import { useOrderStore, type OrderStage } from '@/store/order';
import { toConfiguration, useStoryStore } from '@/store/story';

const STAGES: OrderStage[] = ['format', 'delivery', 'summary'];

export function OrderFlow() {
  const ready = useHydratedStores();
  const { t, locale } = useI18n();
  const reduce = useReducedMotion();
  const draft = useStoryStore((s) => s.draft);
  const order = useOrderStore();
  const book = useMemo(() => {
    const config = toConfiguration(draft);
    return config ? previewStorybook(config) : null;
  }, [draft]);

  if (!ready) return <div className="min-h-dvh" aria-busy="true" />;

  if (!book) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-sm">
          <BookOpen className="mx-auto size-10 text-gold-deep" />
          <h1 className="font-display mt-4 text-3xl">{t.order.emptyTitle}</h1>
          <p className="mt-3 text-ink-soft">{t.order.emptyBody}</p>
          <Link href="/create" className={buttonClass('primary', 'lg', 'mt-8')}>
            {t.nav.create}
          </Link>
        </div>
      </main>
    );
  }

  const format = BOOK_FORMATS[order.formatId];
  const stageIndex = STAGES.indexOf(order.stage);

  return (
    <div className="min-h-dvh">
      <header className="flex h-16 items-center justify-between gap-3 px-4 sm:px-8">
        <Link href="/" aria-label={t.nav.home} className="rounded-lg">
          <Logo locale={locale} className="[&>span:last-child]:text-xl" />
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-3 py-1 text-[0.78rem] font-medium text-gold-deep">
          <Sparkles className="size-3.5" /> {t.demo.badge}
        </span>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-4 pb-16 sm:px-8">
        {order.stage !== 'recorded' && (
          <ol className="mb-8 flex items-center gap-2 text-[0.85rem]" aria-label={t.order.title}>
            {t.order.steps.map((label, i) => (
              <li key={label} className="flex items-center gap-2" aria-current={i === stageIndex ? 'step' : undefined}>
                <span className={`grid size-7 place-items-center rounded-full text-[0.8rem] font-semibold ${i < stageIndex ? 'bg-sage-deep text-ivory' : i === stageIndex ? 'bg-ink text-ivory' : 'bg-ink/8 text-ink-muted'}`}>
                  {i < stageIndex ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={i === stageIndex ? 'font-medium' : 'text-ink-muted max-sm:hidden'}>{label}</span>
                {i < STAGES.length - 1 && <span className="mx-1 h-px w-6 bg-ink/15 sm:w-10" />}
              </li>
            ))}
          </ol>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={order.stage}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {order.stage === 'format' && <FormatStage book={book} />}
            {order.stage === 'delivery' && <DeliveryStage physical={format.physical} />}
            {order.stage === 'summary' && <SummaryStage book={book} />}
            {order.stage === 'recorded' && <RecordedStage />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function FormatVisual({ id, book }: { id: BookFormatId; book: Storybook }) {
  if (id === 'digital-pdf') {
    return (
      <div className="relative mx-auto w-[72%] rounded-[14px] bg-ink p-[5%] shadow-[var(--shadow-soft)]">
        <div className="pointer-events-none">
          <BookCover title={book.title} name="" world={book.config.world} dir={book.direction} angle={0} />
        </div>
        <Tablet className="absolute -end-2 -bottom-2 size-7 rounded-full bg-ivory p-1 text-ink" aria-hidden />
      </div>
    );
  }
  return (
    <div className={`pointer-events-none mx-auto ${id === 'premium-hardcover' ? 'w-[78%]' : 'w-[68%]'}`}>
      <BookCover title={book.title} name="" world={book.config.world} dir={book.direction} angle={id === 'premium-hardcover' ? 26 : 16} />
    </div>
  );
}

function FormatStage({ book }: { book: Storybook }) {
  const { t, locale } = useI18n();
  const { formatId, quantity, setFormat, setQuantity, setStage } = useOrderStore();
  const format = BOOK_FORMATS[formatId];

  return (
    <div>
      <h1 className="font-display text-4xl tracking-[-0.02em] sm:text-5xl">{t.order.title}</h1>
      <p className="mt-2 text-lg text-ink-soft">{t.order.subtitle}</p>

      <fieldset className="mt-8">
        <legend className="sr-only">{t.order.format}</legend>
        <div className="grid gap-4 md:grid-cols-3">
          {FORMAT_ORDER.map((id) => {
            const f = BOOK_FORMATS[id];
            const copy = t.order.formats[id];
            const checked = formatId === id;
            return (
              <label key={id} className="group relative block cursor-pointer">
                <input type="radio" name="format" value={id} checked={checked} onChange={() => setFormat(id)} className="peer sr-only" />
                <span
                  className={`flex h-full flex-col rounded-[1.5rem] border p-5 transition-[border-color,box-shadow,background-color] peer-focus-visible:ring-4 peer-focus-visible:ring-lavender-deep/40 ${
                    checked ? 'border-ink bg-ivory shadow-[0_16px_40px_-18px_rgb(32_38_61/0.55)]' : 'border-ink/12 bg-ivory/60 hover:border-ink/30'
                  }`}
                >
                  {id === 'premium-hardcover' && <span className="absolute -top-3 start-5 rounded-full bg-gold px-3 py-1 text-[0.75rem] font-semibold text-ink">{t.order.recommended}</span>}
                  <span className="block py-6">
                    <FormatVisual id={id} book={book} />
                  </span>
                  <span className="font-display text-2xl">{copy.name}</span>
                  <span className="mt-1.5 text-[0.95rem] leading-snug text-ink-soft">{copy.body}</span>
                  <ul className="mt-4 space-y-1.5 text-[0.9rem]">
                    {[...copy.features, t.order.pages(f.pages), ...(f.dimensionsCm ? [t.order.size(f.dimensionsCm)] : [])].map((feat) => (
                      <li key={feat} className="flex items-center gap-2">
                        <Check className="size-4 text-sage-deep" aria-hidden /> {feat}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-auto flex items-end justify-between gap-3 pt-6">
                    <span className="font-display text-3xl tabular-nums">{formatPrice(f.price, locale)}</span>
                    {f.pricePlaceholder && <span className="rounded-full bg-coral/30 px-2.5 py-1 text-[0.72rem] font-semibold text-coral-deep">{t.order.placeholderPrice}</span>}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="mt-5 flex items-start gap-2 text-[0.9rem] text-ink-muted">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {t.order.placeholderNotice}
      </p>

      <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-ink/10 bg-ivory/90 px-4 pt-4 md:static md:mx-0 md:rounded-2xl md:border-0 md:bg-transparent md:px-0 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {format.physical ? (
            <div className="flex items-center gap-3">
              <span className="text-[0.9rem] font-medium">{t.order.quantity}</span>
              <button type="button" className="grid size-11 place-items-center rounded-full ring-1 ring-ink/15 disabled:opacity-35" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)} aria-label={`${t.order.quantity} −1`}>
                <Minus className="size-4" />
              </button>
              <output aria-live="polite" className="font-display w-6 text-center text-xl tabular-nums">
                {quantity}
              </output>
              <button type="button" className="grid size-11 place-items-center rounded-full ring-1 ring-ink/15 disabled:opacity-35" disabled={quantity >= MAX_QUANTITY} onClick={() => setQuantity(quantity + 1)} aria-label={`${t.order.quantity} +1`}>
                <Plus className="size-4" />
              </button>
            </div>
          ) : (
            <span />
          )}
          <div className="flex flex-1 items-center justify-end gap-4 sm:flex-none">
            <span className="text-end">
              <span className="block text-[0.75rem] text-ink-muted">{t.order.subtotal}</span>
              <span className="font-display text-2xl tabular-nums">{formatPrice(subtotal(formatId, quantity), locale)}</span>
            </span>
            <button type="button" onClick={() => setStage('delivery')} className={buttonClass('primary', 'lg')}>
              {t.order.continue} <ArrowRight className="size-5 rtl:-scale-x-100" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeliveryStage({ physical }: { physical: boolean }) {
  const { t } = useI18n();
  const err = useErrorText();
  const { delivery, setDelivery, setStage } = useOrderStore();
  const schema = useMemo(() => deliverySchema(physical), [physical]);
  const { register, handleSubmit, formState } = useForm<DeliveryValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', phone: '', email: '', city: '', address: '', postalCode: '', notes: '', ...delivery },
    mode: 'onTouched',
  });
  const f = t.order.fields;
  const e = formState.errors;

  const field = (name: keyof DeliveryValues, label: string, props: Record<string, unknown> = {}, optional = false) => (
    <div>
      <Label htmlFor={`d-${name}`} optional={optional}>
        {label}
      </Label>
      <TextInput id={`d-${name}`} aria-invalid={!!e[name] || undefined} aria-describedby={`d-${name}-err`} {...props} {...register(name)} />
      <FieldError id={`d-${name}-err`}>{err(e[name]?.message)}</FieldError>
    </div>
  );

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => {
        setDelivery({ ...values, email: values.email || undefined, postalCode: values.postalCode || undefined, notes: values.notes || undefined, city: values.city ?? '', address: values.address ?? '' });
        setStage('summary');
      })}
      className="mx-auto max-w-2xl"
    >
      <h1 className="font-display text-4xl tracking-[-0.02em] sm:text-5xl">{physical ? t.order.deliveryTitle : t.order.digitalTitle}</h1>
      <p className="mt-4 flex items-start gap-2 rounded-2xl bg-sage/40 p-4 text-[0.92rem] text-ink-soft">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden /> {t.order.privacy}
      </p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">{field('fullName', f.fullName, { autoComplete: 'name' })}</div>
        {field('phone', f.phone, { type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: f.phonePlaceholder, dir: 'ltr' })}
        {field('email', f.email, { type: 'email', inputMode: 'email', autoComplete: 'email', dir: 'ltr' }, physical)}
        {physical && (
          <>
            {field('city', f.city, { autoComplete: 'address-level2', placeholder: f.cityPlaceholder })}
            {field('postalCode', f.postalCode, { inputMode: 'numeric', autoComplete: 'postal-code', maxLength: 5, dir: 'ltr' }, true)}
            <div className="sm:col-span-2">{field('address', f.address, { autoComplete: 'street-address', placeholder: f.addressPlaceholder })}</div>
            <div className="sm:col-span-2">
              <Label htmlFor="d-notes" optional>
                {f.notes}
              </Label>
              <TextArea id="d-notes" maxLength={240} {...register('notes')} />
            </div>
          </>
        )}
      </div>
      <div className="mt-10 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setStage('format')} className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 font-medium text-ink-soft hover:bg-ink/5">
          <ArrowLeft className="size-5 rtl:-scale-x-100" /> {t.studio.back}
        </button>
        <button type="submit" className={buttonClass('primary', 'lg')}>
          {t.order.review} <ArrowRight className="size-5 rtl:-scale-x-100" />
        </button>
      </div>
    </form>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-end font-medium">{children}</dd>
    </div>
  );
}

function SummaryStage({ book }: { book: Storybook }) {
  const { t, locale } = useI18n();
  const { formatId, quantity, delivery, setStage, record } = useOrderStore();
  const [busy, setBusy] = useState(false);
  const format = BOOK_FORMATS[formatId];

  const submit = async () => {
    if (!delivery) return setStage('delivery');
    setBusy(true);
    record(await orderGateway.submit({ formatId, quantity, delivery, storyTitle: book.title }));
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[0.8fr_1fr] lg:items-start">
      <div className="mx-auto w-full max-w-xs lg:sticky lg:top-8">
        <BookCover title={book.title} tagline={book.tagline} name={book.config.child.firstName} world={book.config.world} photo={book.config.child.photo} companion={book.config.companions.length > 0} eyebrow="Hikaya" dir={book.direction} angle={20} />
      </div>
      <div>
        <h1 className="font-display text-4xl tracking-[-0.02em] sm:text-5xl">{t.order.summary}</h1>
        <dl className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
          <Row label={t.order.story}>
            <span dir={book.direction}>{book.title}</span>
          </Row>
          <Row label={t.order.format}>
            {t.order.formats[formatId].name}
            {format.physical && ` × ${quantity}`}
          </Row>
          <Row label={t.order.subtotal}>
            <span className="tabular-nums">{formatPrice(subtotal(formatId, quantity), locale)}</span>
            {format.pricePlaceholder && <span className="block text-[0.75rem] font-normal text-coral-deep">{t.order.placeholderPrice}</span>}
          </Row>
          <Row label={t.order.shipping}>{format.physical ? t.order.shippingLater : t.order.shippingNone}</Row>
        </dl>
        {delivery && (
          <div className="mt-6 rounded-2xl bg-paper p-5">
            <div className="flex items-center justify-between">
              <p className="font-medium">{format.physical ? t.order.deliveryTitle : t.order.digitalTitle}</p>
              <button type="button" onClick={() => setStage('delivery')} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[0.9rem] text-ink-soft hover:bg-ink/5">
                <Pencil className="size-4" /> {t.order.editDelivery}
              </button>
            </div>
            {/* Each line isolates its own direction: Latin addresses stay readable in the Arabic UI. */}
            <address className="mt-2 flex flex-col leading-relaxed text-ink-soft not-italic">
              <span dir="auto">{delivery.fullName}</span>
              <span dir="ltr" className="self-start rtl:self-end">
                {delivery.phone}
              </span>
              {delivery.email && <span dir="auto">{delivery.email}</span>}
              {format.physical && <span dir="auto">{[delivery.address, [delivery.postalCode, delivery.city].filter(Boolean).join(' ')].join(', ')}</span>}
            </address>
          </div>
        )}
        <p className="mt-6 flex items-start gap-2 rounded-2xl bg-lavender/50 p-4 text-[0.92rem] text-ink-soft">
          <Info className="mt-0.5 size-4 shrink-0 text-lavender-deep" aria-hidden /> {t.order.noPayment}
        </p>
        <div className="mt-8 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <button type="button" onClick={() => setStage('delivery')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 font-medium text-ink-soft hover:bg-ink/5">
            <ArrowLeft className="size-5 rtl:-scale-x-100" /> {t.studio.back}
          </button>
          <button type="button" onClick={submit} disabled={busy} className={buttonClass('primary', 'lg')}>
            {t.order.submit}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordedStage() {
  const { t } = useI18n();
  const { recorded, clear } = useOrderStore();
  const reset = useStoryStore((s) => s.reset);
  return (
    <div className="mx-auto max-w-xl py-8 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-sage/60 text-sage-deep">
        <CircleCheck className="size-8" />
      </span>
      <h1 className="font-display mt-6 text-3xl leading-tight sm:text-4xl">{t.order.demoTitle}</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-soft">{t.order.demoBody}</p>
      {recorded && (
        <p className="mt-6 inline-flex flex-col rounded-2xl bg-paper px-6 py-3">
          <span className="text-[0.75rem] font-semibold tracking-[0.12em] text-ink-muted uppercase">{t.order.reference}</span>
          <span className="font-display text-xl tracking-wide" dir="ltr">
            {recorded.id}
          </span>
        </p>
      )}
      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/preview" className={buttonClass('secondary', 'lg')}>
          <BookOpen className="size-5" /> {t.order.backToBook}
        </Link>
        <Link
          href="/create"
          onClick={() => {
            clear();
            reset();
          }}
          className={buttonClass('primary', 'lg')}
        >
          {t.order.newStory}
        </Link>
      </div>
    </div>
  );
}
