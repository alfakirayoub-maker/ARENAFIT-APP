'use client';

import { buildStationPrintSvg, PRINT_FORMATS, stationSlug, type PrintFormat } from '@arenafit/reception-print';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { StationSecret } from '@/lib/admin/stations';

import { Button, Notice } from './ui';

/** Official logo as a data: URI so downloaded SVGs are self-contained. */
function useLogoDataUri(): string | null {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/brand/arena-fit-logo.png')
      .then((r) => r.blob())
      .then(
        (b) =>
          new Promise<string>((resolve) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result));
            fr.readAsDataURL(b);
          }),
      )
      .then((u) => alive && setUri(u));
    return () => {
      alive = false;
    };
  }, []);
  return uri;
}

/**
 * Shown ONCE right after a station is created or its QR rotated. The QR
 * payload lives only in this component's memory: it is drawn into the QR,
 * never written as text, never stored. Closing the panel discards it.
 */
export function StationPrintPanel({ secret, onClose }: { secret: StationSecret; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const logo = useLogoDataUri();
  const [done, setDone] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const svgs = useMemo(() => {
    if (!logo) return null;
    const make = (format: PrintFormat) => buildStationPrintSvg({ payload: secret.qrPayload, stationName: secret.name, format, logoHref: logo });
    return { a5: make('a5'), a6: make('a6') };
  }, [logo, secret]);

  const urls = useMemo(() => {
    if (!svgs) return null;
    return {
      a5: URL.createObjectURL(new Blob([svgs.a5], { type: 'image/svg+xml' })),
      a6: URL.createObjectURL(new Blob([svgs.a6], { type: 'image/svg+xml' })),
    };
  }, [svgs]);
  useEffect(
    () => () => {
      if (urls) {
        URL.revokeObjectURL(urls.a5);
        URL.revokeObjectURL(urls.a6);
      }
    },
    [urls],
  );

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  const download = (format: PrintFormat) => {
    if (!urls) return;
    const a = document.createElement('a');
    a.href = urls[format];
    a.download = `arena-fit-${stationSlug(secret.name)}-${format}.svg`;
    a.click();
    setDone(true);
  };

  const print = (format: PrintFormat) => {
    if (!svgs) return;
    const { w, h } = PRINT_FORMATS[format];
    const win = window.open('', '_blank', 'noopener=no,width=800,height=1000');
    if (!win) return;
    win.document.write(
      `<!doctype html><html><head><title>Arena Fit — ${secret.name}</title><style>@page{size:${w}mm ${h}mm;margin:0}html,body{margin:0}svg{display:block;width:${w}mm;height:${h}mm}</style></head><body>${svgs[format]}</body></html>`,
    );
    win.document.close();
    win.onload = () => win.print();
    setTimeout(() => win.print(), 400);
    setDone(true);
  };

  const close = () => (done ? onClose() : setConfirmClose(true));

  return (
    <dialog
      ref={ref}
      className="modal wide"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="print-title">
      <div className="modal-body">
        <h2 id="print-title">QR à imprimer — {secret.name}</h2>
        <Notice tone="warning">
          Ce QR n’est affiché qu’une seule fois. Téléchargez-le ou imprimez-le maintenant : il ne pourra pas être affiché à nouveau
          (en cas de perte, renouvelez le QR de la station).
        </Notice>
        {!urls ? (
          <div className="skeleton" style={{ height: 360 }} />
        ) : (
          <div className="print-previews">
            <figure>
              <div className="sheet">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={urls.a5} alt="Aperçu A5" />
              </div>
              <figcaption className="row">
                <strong className="grow">Affiche A5</strong>
                <Button size="sm" onClick={() => print('a5')}>
                  Imprimer
                </Button>
                <Button size="sm" onClick={() => download('a5')}>
                  Télécharger
                </Button>
              </figcaption>
            </figure>
            <figure>
              <div className="sheet">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={urls.a6} alt="Aperçu A6 comptoir" />
              </div>
              <figcaption className="row">
                <strong className="grow">Carte comptoir A6</strong>
                <Button size="sm" onClick={() => print('a6')}>
                  Imprimer
                </Button>
                <Button size="sm" onClick={() => download('a6')}>
                  Télécharger
                </Button>
              </figcaption>
            </figure>
          </div>
        )}
        <p className="faint small">Imprimez à 100 % sur papier blanc mat. Ne couvrez pas la marge blanche autour du QR.</p>
        {confirmClose && (
          <Notice tone="danger">
            <span className="grow">Vous n’avez ni imprimé ni téléchargé ce QR. Fermer quand même ?</span>
            <Button size="sm" variant="danger" onClick={onClose}>
              Fermer sans imprimer
            </Button>
          </Notice>
        )}
      </div>
      <div className="modal-actions">
        <Button variant="primary" onClick={close}>
          {done ? 'Terminé' : 'Fermer'}
        </Button>
      </div>
    </dialog>
  );
}
