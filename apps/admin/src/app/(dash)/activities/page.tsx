'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { RequireCapability } from '@/components/Staff';
import { Thumb } from '@/components/Thumb';
import { Badge, LoadError, PageHeader, Skeleton } from '@/components/ui';
import { useActivities } from '@/lib/admin/hooks';
import { CATEGORY_LABEL } from '@/lib/labels';

function ActivitiesPageContent() {
  const router = useRouter();
  const activities = useActivities();
  return (
    <>
      <PageHeader
        title="Activités"
        subtitle="Une activité inactive disparaît de l’application ; ses cours passés restent dans l’historique."
        actions={
          <Link className="btn primary" href="/activities/new">
            Nouvelle activité
          </Link>
        }
      />
      {activities.isError ? (
        <LoadError onRetry={() => activities.refetch()} />
      ) : !activities.data ? (
        <Skeleton height={300} />
      ) : (
        <section className="card pad-0 table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th aria-label="Image" />
                <th>Activité</th>
                <th>Catégorie</th>
                <th>Intensité</th>
                <th>Durée</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {activities.data.map((a) => (
                <tr key={a.id} className={`link${a.is_active ? '' : ' dim'}`} onClick={() => router.push(`/activities/${a.id}`)}>
                  <td className="thumb-cell">
                    <Thumb bucket="activities" path={a.image_path} />
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    <Link href={`/activities/${a.id}`}>{a.name}</Link>
                  </td>
                  <td className="muted">{CATEGORY_LABEL[a.category]}</td>
                  <td className="muted">{a.intensity ? `${a.intensity}/5` : '—'}</td>
                  <td className="muted">{a.default_duration_min ? `${a.default_duration_min} min` : '—'}</td>
                  <td>{a.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

/** Gate first: the page's queries only run for roles allowed to see it. */
export default function ActivitiesPage() {
  return (
    <RequireCapability capability="activities">
      <ActivitiesPageContent />
    </RequireCapability>
  );
}
