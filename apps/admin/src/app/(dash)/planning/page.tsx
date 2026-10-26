'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { RequireCapability } from '@/components/Staff';
import { Badge, Button, LoadError, PageHeader, Skeleton } from '@/components/ui';
import { useActivities, useCoaches, useSessions } from '@/lib/admin/hooks';
import { addDays, clubToday, formatDate, formatDayShort, hhmm, isClubDate, weekDates, weekStart } from '@/lib/dates';

/** Week planning in club wall-clock time (what members see in the app). */
function PlanningWeek() {
  const router = useRouter();
  const params = useSearchParams();
  const today = clubToday();
  const requested = params.get('week');
  const monday = weekStart(requested && isClubDate(requested) ? requested : today);
  const days = weekDates(monday);
  const sessions = useSessions(monday, days[6]);
  const activities = useActivities();
  const coaches = useCoaches();
  const [activity, setActivity] = useState('');
  const [coach, setCoach] = useState('');

  const go = (date: string) => router.push(`/planning?week=${date}`);
  const rows = (sessions.data ?? []).filter((s) => (!activity || s.activity_id === activity) && (!coach || s.coach_id === coach));
  const count = rows.filter((s) => !s.is_cancelled).length;

  return (
    <>
      <PageHeader
        title="Planning"
        subtitle={`Semaine du ${formatDate(monday)} · ${count} cours · heures du club (Casablanca)`}
        actions={
          <>
            <Button onClick={() => go(addDays(monday, -7))} aria-label="Semaine précédente">
              ←
            </Button>
            <Button onClick={() => go(today)}>Aujourd’hui</Button>
            <Button onClick={() => go(addDays(monday, 7))} aria-label="Semaine suivante">
              →
            </Button>
            <Link className="btn primary" href={`/planning/new?date=${days.includes(today) ? today : monday}`}>
              Nouveau cours
            </Link>
          </>
        }
      />

      <div className="row">
        <select className="select" style={{ width: 220 }} value={activity} onChange={(e) => setActivity(e.target.value)} aria-label="Filtrer par activité">
          <option value="">Toutes les activités</option>
          {(activities.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select className="select" style={{ width: 200 }} value={coach} onChange={(e) => setCoach(e.target.value)} aria-label="Filtrer par coach">
          <option value="">Tous les coachs</option>
          {(coaches.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>
        <span className="faint small">Barré = annulé · pointillés = masqué ou réservé aux membres</span>
      </div>

      {sessions.isError ? (
        <LoadError onRetry={() => sessions.refetch()} />
      ) : (
        <div className="week">
          {days.map((d) => {
            const list = rows.filter((s) => s.session_date === d);
            return (
              <div className="day" key={d}>
                <div className={`day-head${d === today ? ' today' : ''}`}>
                  <h3 style={{ textTransform: 'capitalize' }}>{formatDayShort(d)}</h3>
                  <span className="faint small">{list.length || ''}</span>
                </div>
                {sessions.isLoading ? (
                  <Skeleton height={70} />
                ) : (
                  list.map((s) => (
                    <button
                      key={s.id}
                      className={`slot${s.is_cancelled ? ' cancelled' : ''}${s.visibility !== 'public' ? ' hidden-vis' : ''}`}
                      onClick={() => router.push(`/planning/${s.id}`)}>
                      <span className="time">
                        {hhmm(s.start_time)}–{hhmm(s.end_time)}
                      </span>
                      <span className="name">{s.activity?.name ?? '—'}</span>
                      <span className="muted small">
                        {s.coach?.display_name ?? 'Coach à définir'}
                        {s.room ? ` · ${s.room.name}` : ''}
                      </span>
                      {(s.is_cancelled || s.visibility !== 'public') && (
                        <span className="row" style={{ gap: 4 }}>
                          {s.is_cancelled && <Badge tone="danger">Annulé</Badge>}
                          {s.visibility === 'hidden' && <Badge>Masqué</Badge>}
                          {s.visibility === 'members' && <Badge tone="accent">Membres</Badge>}
                        </span>
                      )}
                    </button>
                  ))
                )}
                <button className="slot-add" onClick={() => router.push(`/planning/new?date=${d}`)}>
                  + Ajouter
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function PlanningPageContent() {
  return (
    <>
      <Suspense fallback={<Skeleton height={400} />}>
        <PlanningWeek />
      </Suspense>
    </>
  );
}

/** Gate first: the page's queries only run for roles allowed to see it. */
export default function PlanningPage() {
  return (
    <RequireCapability capability="planning">
      <PlanningPageContent />
    </RequireCapability>
  );
}
