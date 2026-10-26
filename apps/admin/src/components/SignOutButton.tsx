'use client';

import { useRouter } from 'next/navigation';

import { getBrowserClient } from '@/lib/supabase/browser';

import { Button } from './ui';

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      onClick={async () => {
        await getBrowserClient().auth.signOut();
        router.replace('/login');
        router.refresh();
      }}>
      Se déconnecter
    </Button>
  );
}
