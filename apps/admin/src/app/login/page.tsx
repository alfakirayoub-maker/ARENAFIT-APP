'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Logo } from '@/components/Logo';
import { Button, Field, Notice } from '@/components/ui';
import { getStaffIdentity } from '@/lib/admin/identity';
import { isConfigured } from '@/lib/env';
import { getBrowserClient } from '@/lib/supabase/browser';

/** Staff sign-in (Supabase Auth). Only accounts with a staff role get in. */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const db = getBrowserClient();
    try {
      const { error: authError } = await db.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) {
        setError('Email ou mot de passe incorrect.');
        return;
      }
      const staff = await getStaffIdentity(db);
      if (!staff) {
        await db.auth.signOut();
        setError('Ce compte n’a pas accès au tableau de bord Arena Fit.');
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <div className="panel">
        <div className="center">
          <Logo height={64} />
        </div>
        <form className="card" onSubmit={submit} noValidate>
          <div>
            <h1 style={{ fontSize: 22 }}>Administration</h1>
            <p className="muted">Espace réservé à l’équipe Arena Fit.</p>
          </div>
          {!isConfigured && <Notice tone="danger">Configuration Supabase manquante.</Notice>}
          {error && <Notice tone="danger">{error}</Notice>}
          <Field label="Email" htmlFor="email">
            <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Mot de passe" htmlFor="password">
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!email || !password}>
            Se connecter
          </Button>
        </form>
        <p className="faint small center">Les comptes sont créés par un administrateur Arena Fit.</p>
      </div>
    </main>
  );
}
