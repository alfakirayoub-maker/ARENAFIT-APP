# Reception check-in — operations

Guests check in by scanning, **with their own phone**, a QR printed at the
reception. The reception needs no device. Each printed QR identifies a
**reception station**; the server redeems the scanning guest's own pass.

All operations below run with the **service role** — in the Supabase SQL editor
(or a future admin backend). Never from the apps, never with the anon key.

## 1. Create a station (once per reception desk)

```sql
select public.create_reception_station('Réception principale');
-- → {"station_id": "…", "name": "Réception principale", "qr_payload": "AFR1.…"}
```

`qr_payload` is shown **once** (only its hash is stored). Copy it straight
into step 2; don't paste it in chats, tickets or commits.

## 2. Generate the print assets

```bash
node scripts/reception/station-qr.mjs 'AFR1.…' --name 'Réception principale' --out ./print --pdf --verify
```

* `reception-principale-a5.svg/.pdf` — A5 poster (wall / stand).
* `reception-principale-a6.svg/.pdf` — A6 counter card.
* `--verify` renders both and decodes the QR back; it fails if the code doesn't
  read exactly. The token is never printed as text.
* Print at 100 % scale on white paper (matte avoids glare). Keep the white
  margin around the code clear — no stickers, frames or tape over it.
* Delete `./print` after printing (it contains the secret in QR form).

## 3. Display

Place the A6 card on the counter and/or the A5 poster at eye level near the
desk, lit, not behind glass with reflections. One station can have several
prints of the same QR.

## 4. Deactivate / reactivate (e.g. desk closed, renovation)

```sql
select public.deactivate_reception_station('<station_id>');   -- scans → « QR désactivé »
select public.reactivate_reception_station('<station_id>');
```

## 5. Rotate if a QR may be compromised (photo shared online, print stolen)

```sql
select public.rotate_reception_station_token('<station_id>');
-- → new qr_payload; the old printed QR stops working immediately
```

Then repeat step 2–3 and destroy the old prints. Rotation keeps the same
station: past redemptions, analytics and guest passes are unaffected.

## 6. Listing stations

```sql
select id, name, active, last_rotated_at, created_at from public.reception_stations order by created_at;
```

## Notes

* **Static QR (MVP).** A photo of the QR could be scanned elsewhere. It still
  requires an authenticated guest holding an active one-use pass, and uses it
  up. Rotate when in doubt. No GPS or time-rotating QR in the MVP.
* **Check-in record:** `guest_redemptions` (station, guest, time) and
  `guest_pass_events` (`reception_qr_scanned` with outcome, `guest_pass_redeemed`).
* **Confirmation window:** the live « PASS VALIDÉ » screen lasts
  `guest_pass.checkin_confirmation_seconds` (default 120) after redemption:
  `update public.app_settings set value = '120' where key = 'guest_pass.checkin_confirmation_seconds';`
