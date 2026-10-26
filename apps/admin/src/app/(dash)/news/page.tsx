'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { RequireCapability } from '@/components/Staff';
import { Badge, Empty, LoadError, PageHeader, Skeleton } from '@/components/ui';
import { useNewsList } from '@/lib/admin/hooks';
import { newsState, type NewsState } from '@/lib/admin/news';
import { formatInstant } from '@/lib/dates';
import { NEWS_CATEGORY_LABEL, NEWS_STATE_BADGE as STATE_BADGE } from '@/lib/labels';

function NewsPageContent() {
  const router = useRouter();
  const news = useNewsList();
  const [filter, setFilter] = useState<NewsState | 'all'>('all');
  const rows = (news.data ?? []).filter((n) => filter === 'all' || newsState(n) === filter);

  return (
    <>
      <PageHeader
        title="Actualités"
        subtitle="Une actualité publiée apparaît dans l’onglet Actualités de l’application au prochain rafraîchissement."
        actions={
          <Link className="btn primary" href="/news/new">
            Nouvel article
          </Link>
        }
      />
      <div className="segmented" role="group" aria-label="Filtrer">
        {(['all', 'draft', 'scheduled', 'published'] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Tous' : STATE_BADGE[f].label + 's'}
          </button>
        ))}
      </div>
      {news.isError ? (
        <LoadError onRetry={() => news.refetch()} />
      ) : !news.data ? (
        <Skeleton height={280} />
      ) : rows.length === 0 ? (
        <section className="card">
          <Empty>Aucun article.</Empty>
        </section>
      ) : (
        <section className="card pad-0 table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Titre</th>
                <th>Catégorie</th>
                <th>Statut</th>
                <th>Publication</th>
                <th>Modifié</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => {
                const st = STATE_BADGE[newsState(n)];
                return (
                  <tr key={n.id} className="link" onClick={() => router.push(`/news/${n.id}`)}>
                    <td style={{ fontWeight: 600 }}>
                      <Link href={`/news/${n.id}`}>{n.title}</Link>
                    </td>
                    <td className="muted">{NEWS_CATEGORY_LABEL[n.category]}</td>
                    <td>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td className="muted small">{n.published_at ? formatInstant(n.published_at) : '—'}</td>
                    <td className="muted small">{formatInstant(n.updated_at)}</td>
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
export default function NewsPage() {
  return (
    <RequireCapability capability="news">
      <NewsPageContent />
    </RequireCapability>
  );
}
