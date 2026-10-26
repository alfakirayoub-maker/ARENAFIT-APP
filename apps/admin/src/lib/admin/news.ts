import { newsSchema, type NewsValues } from '../validation';
import { run, type Db } from './core';

export type NewsRow = NewsValues & { id: string; status: 'draft' | 'published'; published_at: string | null; updated_at: string };

/** draft · scheduled (published, date in the future) · published */
export type NewsState = 'draft' | 'scheduled' | 'published';
export function newsState(n: Pick<NewsRow, 'status' | 'published_at'>, now: Date = new Date()): NewsState {
  if (n.status === 'draft') return 'draft';
  return n.published_at && Date.parse(n.published_at) > now.getTime() ? 'scheduled' : 'published';
}

const SELECT = 'id, slug, category, title, excerpt, body, cover_path, status, published_at, updated_at';

export const listNews = (db: Db) =>
  run<NewsRow[]>(db.from('news').select(SELECT).order('updated_at', { ascending: false }).returns<NewsRow[]>());

export const getNews = (db: Db, id: string) => run<NewsRow>(db.from('news').select(SELECT).eq('id', id).returns<NewsRow[]>().single());

/** Saves content; publication state is changed separately (publish / schedule / unpublish). */
export async function saveNews(db: Db, id: string | null, input: unknown): Promise<string> {
  const values = newsSchema.parse(input);
  const saved = id
    ? await run<{ id: string }>(db.from('news').update(values).eq('id', id).select('id').single())
    : await run<{ id: string }>(db.from('news').insert({ ...values, status: 'draft' }).select('id').single());
  return saved.id;
}

/** Publish now, or at `at` (scheduled: public reads only return it from that instant). */
export async function publishNews(db: Db, id: string, at: Date = new Date()): Promise<void> {
  await run(db.from('news').update({ status: 'published', published_at: at.toISOString() }).eq('id', id).select('id').single());
}

export async function unpublishNews(db: Db, id: string): Promise<void> {
  await run(db.from('news').update({ status: 'draft', published_at: null }).eq('id', id).select('id').single());
}
