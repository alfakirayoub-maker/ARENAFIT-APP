import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};

export function Button({ variant = 'secondary', size = 'md', loading, children, className, disabled, ...rest }: ButtonProps) {
  const cls = ['btn', variant !== 'secondary' && variant, size !== 'md' && size, className].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="spinner" aria-hidden />}
      {children}
    </button>
  );
}

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export function Badge({ tone = 'neutral', children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`badge ${tone === 'neutral' ? '' : tone}`}>
      {dot && <span className="dot" aria-hidden />}
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="sub">{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  full,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`field${full ? ' full' : ''}`}>
      {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span className="label">{label}</span>}
      {children}
      {error ? (
        <span className="error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function Notice({ tone = 'neutral', children }: { tone?: 'neutral' | 'warning' | 'danger' | 'accent'; children: ReactNode }) {
  return (
    <div className={`notice ${tone === 'neutral' ? '' : tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Skeleton({ height = 120 }: { height?: number }) {
  return <div className="skeleton" style={{ height }} aria-hidden />;
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Notice tone="danger">
      <span className="grow">Impossible de charger les données.</span>
      <Button size="sm" onClick={onRetry}>
        Réessayer
      </Button>
    </Notice>
  );
}
