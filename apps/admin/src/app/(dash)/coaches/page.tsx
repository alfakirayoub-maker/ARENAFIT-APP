'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { RequireCapability } from '@/components/Staff';
import { Badge, LoadError, PageHeader, Skeleton } from '@/components/ui';
import { useActivities, useCoaches } from '@/lib/admin/hooks';
import { publicImageUrl } from '@/lib/admin/storage';
import { getBrowserClient } from '@/lib/supabase/browser';

function CoachesPageContent() {
  const router = useRouter();
  const coaches = useCoaches();
  const activities = useActivities();
  const name = (id: string) => activities.data?.find((a) => a.id === id)?.name;
  const db = getBrowserClient();

  return (
    <>
      <PageHeader
        title="Coachs"
        subtitle="Les coachs inactifs disparaissent de l’application ; leur historique de cours est conservé."
        actions={
          <Link className="btn primary" href="/coaches/new">
            Nouveau coach
          </Link>
        }
      />
      {coaches.isError ? (
        <LoadError onRetry={() => coaches.refetch()} />
      ) : !coaches.data ? (
        <Skeleton height={300} />
      ) : (
        <section className="card pad-0 table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 64 }}></th>
                <th>Coach</th>
                <th>Activités</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {coaches.data.map((c) => {
                const photo = publicImageUrl(db, 'coaches', c.photo_path);
                return (
                  <tr key={c.id} className={`link${c.is_active ? '' : ' dim'}`} onClick={() => router.push(`/coaches/${c.id}`)}>
                    <td>
                      <div
                        className="image-field"
                        aria-hidden
                        style={{ width: 36, height: 36, borderRadius: '50%', background: photo ? `center/cover url("${photo}")` : 'var(--surface-3)' }}
                      />
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      <Link href={`/coaches/${c.id}`}>{c.display_name}</Link>
                    </td>
                    <td className="muted">
                      {c.activity_ids
                        .map(name)
                        .filter(Boolean)
                        .sort()
                        .join(', ') || '—'}
                    </td>
                    <td>{c.is_active ? <Badge tone="success">Actif</Badge> : <Badge>Inactif</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

/** Gate first: the page's queries only run for roles allowed to see it. */
export default function CoachesPage() {
  return (
    <RequireCapability capability="coaches">
      <CoachesPageContent />
    </RequireCapability>
  );
}
