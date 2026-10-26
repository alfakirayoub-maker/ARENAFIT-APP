"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { RequireCapability, useCan } from "@/components/Staff";
import { StationPrintPanel } from "@/components/StationPrintPanel";
import {
  Badge,
  Button,
  Empty,
  Field,
  LoadError,
  PageHeader,
  Skeleton,
} from "@/components/ui";
import { keys, useAction, useStations } from "@/lib/admin/hooks";
import { createStation, type StationSecret } from "@/lib/admin/stations";
import { formatInstant } from "@/lib/dates";

function StationsPageContent() {
  const router = useRouter();
  const canManage = useCan("stationManage");
  const stations = useStations();
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<StationSecret | null>(null);
  const create = useAction((db, n: string) => createStation(db, n), {
    success: "Station créée",
    invalidate: [keys.stations],
    gcTime: 0, // the payload must not linger in the mutation cache
    onSuccess: (s) => {
      setName("");
      setSecret(s);
    },
  });

  return (
    <>
      <PageHeader
        title="Stations réception"
        subtitle="Chaque station correspond à un QR imprimé, scanné par les invités avec leur téléphone."
      />
      {canManage && (
        <section className="card">
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) create.mutate(name);
            }}
          >
            <Field label="Nouvelle station" htmlFor="station-name">
              <input
                id="station-name"
                className="input"
                style={{ width: 300 }}
                placeholder="Ex. Réception principale"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Button
              type="submit"
              variant="primary"
              loading={create.isPending}
              disabled={!name.trim()}
              style={{ alignSelf: "flex-end" }}
            >
              Créer la station
            </Button>
          </form>
        </section>
      )}
      {stations.isError ? (
        <LoadError onRetry={() => stations.refetch()} />
      ) : !stations.data ? (
        <Skeleton height={200} />
      ) : stations.data.length === 0 ? (
        <section className="card">
          <Empty>
            Aucune station. Créez la « Réception principale » pour imprimer son
            QR.
          </Empty>
        </section>
      ) : (
        <section className="card pad-0 table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Station</th>
                <th>Statut</th>
                <th>Créée</th>
                <th>QR renouvelé</th>
                <th>Pass validés</th>
                <th>Dernier passage</th>
              </tr>
            </thead>
            <tbody>
              {stations.data.map((s) => (
                <tr
                  key={s.id}
                  className={`link${s.active ? "" : " dim"}`}
                  onClick={() => router.push(`/stations/${s.id}`)}
                >
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>
                    {s.active ? (
                      <Badge tone="success" dot>
                        Active
                      </Badge>
                    ) : (
                      <Badge dot>Désactivée</Badge>
                    )}
                  </td>
                  <td className="muted small">{formatInstant(s.created_at)}</td>
                  <td className="muted small">
                    {formatInstant(s.last_rotated_at)}
                  </td>
                  <td className="mono">{s.redemptions}</td>
                  <td className="muted small">
                    {formatInstant(s.last_redeemed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {secret && (
        <StationPrintPanel
          secret={secret}
          onClose={() => {
            setSecret(null);
            create.reset(); // drop the payload from the mutation result too
          }}
        />
      )}
    </>
  );
}

/** Gate first: the page's queries only run for roles allowed to see it. */
export default function StationsPage() {
  return (
    <RequireCapability capability="stations">
      <StationsPageContent />
    </RequireCapability>
  );
}
