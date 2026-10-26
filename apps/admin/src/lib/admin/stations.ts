import { z } from 'zod';

import { stationNameSchema } from '../validation';
import { run, runParsed, type Db } from './core';

const station = z.object({
  id: z.uuid(),
  name: z.string(),
  active: z.boolean(),
  created_at: z.string(),
  last_rotated_at: z.string().nullable(),
  redemptions: z.number(),
  last_redeemed_at: z.string().nullable(),
});
export type Station = z.output<typeof station>;

/**
 * The printable QR content, returned ONCE by create / rotate. Callers keep it
 * in memory only for the print step — never stored, logged or cached.
 */
export type StationSecret = { stationId: string; name: string; qrPayload: string };

const secret = z
  .object({ station_id: z.uuid(), name: z.string(), qr_payload: z.string().regex(/^AFR1\.[A-Za-z0-9_-]{43}$/) })
  .transform((s): StationSecret => ({ stationId: s.station_id, name: s.name, qrPayload: s.qr_payload }));

export const listStations = (db: Db) => runParsed(z.array(station), db.rpc('admin_list_reception_stations'));

export const createStation = (db: Db, name: string) =>
  runParsed(secret, db.rpc('admin_create_reception_station', { p_name: stationNameSchema.parse(name) }));

export const rotateStation = (db: Db, id: string) => runParsed(secret, db.rpc('admin_rotate_reception_station', { p_station_id: id }));

export async function setStationActive(db: Db, id: string, active: boolean): Promise<void> {
  await run(db.rpc('admin_set_reception_station_active', { p_station_id: id, p_active: active }));
}
