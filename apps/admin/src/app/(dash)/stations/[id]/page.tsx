"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { AuditTrail } from "@/components/AuditTrail";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RequireCapability, useCan } from "@/components/Staff";
import { StationPrintPanel } from "@/components/StationPrintPanel";
import {
  Badge,
  Button,
  LoadError,
  Notice,
  PageHeader,
  Skeleton,
} from "@/components/ui";
import { keys, useAction, useStations } from "@/lib/admin/hooks";
import {
  rotateStation,
  setStationActive,
  type StationSecret,
} from "@/lib/admin/stations";
import { formatInstant } from "@/lib/dates";

function StationDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canManage = useCan("stationManage");
  const isAdmin = useCan("audit");
  const stations = useStations();
  const station = stations.data?.find((s) => s.id === id);
  const [confirm, setConfirm] = useState<"rotate" | "deactivate" | null>(null);
  const [secret, setSecret] = useState<StationSecret | null>(null);
  const invalidate = [keys.stations, keys.audit(id)];

  const rotate = useAction((db) => rotateStation(db, id), {
    success: "Nouveau QR généré — l’ancien ne fonctionne plus",
    invalidate,
    gcTime: 0, // the payload must not linger in the mutation cache
    onSuccess: (s) => {
      setConfirm(null);
      setSecret(s);
    },
  });
  const toggle = useAction(
    (db, active: boolean) => setStationActive(db, id, active),
    {
      success: () =>
        station?.active ? "Station désactivée" : "Station réactivée",
      invalidate,
      onSuccess: () => setConfirm(null),
    },
  );

  return (
    <>
      {stations.isError ? (
        <LoadError onRetry={() => stations.refetch()} />
      ) : !stations.data ? (
        <Skeleton height={300} />
      ) : !station ? (
        <Notice>Station introuvable.</Notice>
      ) : (
        <>
          <PageHeader
            title={station.name}
            subtitle={
              station.active ? (
                <Badge tone="success" dot>
                  Active — les invités peuvent scanner son QR
                </Badge>
              ) : (
                <Badge dot>Désactivée — le QR est refusé</Badge>
              )
            }
            actions={
              <Button variant="ghost" onClick={() => router.push("/stations")}>
                Retour
              </Button>
            }
          />
          <div className="cards">
            <div className="card stat">
              <span className="label">Créée</span>
              <span>{formatInstant(station.created_at)}</span>
            </div>
            <div className="card stat">
              <span className="label">QR renouvelé</span>
              <span>
                {station.last_rotated_at
                  ? formatInstant(station.last_rotated_at)
                  : "Jamais"}
              </span>
            </div>
            <div className="card stat">
              <span className="label">Pass validés</span>
              <span className="value">{station.redemptions}</span>
            </div>
            <div className="card stat">
              <span className="label">Dernier passage</span>
              <span>{formatInstant(station.last_redeemed_at)}</span>
            </div>
          </div>

          {canManage ? (
            <section className="card">
              <h2 style={{ marginBottom: 6 }}>Actions</h2>
              <p className="muted" style={{ marginBottom: 12 }}>
                Le QR imprimé n’est jamais réaffiché. Pour réimprimer,
                renouvelez le QR : un nouveau QR est généré et l’ancien cesse de
                fonctionner. L’historique des passages reste attaché à cette
                station.
              </p>
              <div className="row">
                <Button variant="primary" onClick={() => setConfirm("rotate")}>
                  Renouveler et imprimer le QR
                </Button>
                {station.active ? (
                  <Button
                    variant="danger"
                    onClick={() => setConfirm("deactivate")}
                  >
                    Désactiver la station
                  </Button>
                ) : (
                  <Button
                    onClick={() => toggle.mutate(true)}
                    loading={toggle.isPending}
                  >
                    Réactiver la station
                  </Button>
                )}
              </div>
            </section>
          ) : (
            <Notice>
              La gestion des stations est réservée aux administrateurs.
            </Notice>
          )}

          {isAdmin && <AuditTrail entityId={id} />}

          <ConfirmDialog
            open={confirm === "rotate"}
            title="Renouveler le QR de cette station ?"
            confirmLabel="Renouveler le QR"
            busy={rotate.isPending}
            onClose={() => setConfirm(null)}
            onConfirm={() => rotate.mutate(undefined)}
          >
            <Notice tone="danger">
              L’ancien QR cessera immédiatement de fonctionner.
            </Notice>
            <p className="muted">
              Préparez l’impression : le nouveau QR s’affiche une seule fois
              juste après.
            </p>
          </ConfirmDialog>
          <ConfirmDialog
            open={confirm === "deactivate"}
            title="Désactiver cette station ?"
            confirmLabel="Désactiver"
            busy={toggle.isPending}
            onClose={() => setConfirm(null)}
            onConfirm={() => toggle.mutate(false)}
          >
            <p className="muted">
              Les invités qui scannent ce QR verront « Ce QR n’est plus actif ».
              Vous pourrez la réactiver.
            </p>
          </ConfirmDialog>
          {secret && (
            <StationPrintPanel
              secret={secret}
              onClose={() => {
                setSecret(null);
                rotate.reset(); // drop the payload from the mutation result too
              }}
            />
          )}
        </>
      )}
    </>
  );
}

/** Gate first: the page's queries only run for roles allowed to see it. */
export default function StationDetail() {
  return (
    <RequireCapability capability="stations">
      <StationDetailContent />
    </RequireCapability>
  );
}
