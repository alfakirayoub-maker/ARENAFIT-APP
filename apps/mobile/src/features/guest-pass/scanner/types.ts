export type ReceptionScannerProps = {
  /** False while a scan is being validated (ignore further frames). */
  active: boolean;
  /** Raw scanned text; validated by the caller (parseReceptionQr). */
  onScan: (data: string) => void;
};
