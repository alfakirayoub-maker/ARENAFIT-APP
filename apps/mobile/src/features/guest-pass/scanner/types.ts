export type ReceptionScannerProps = {
  /** False while a scan is being validated: frames are not reported. */
  active: boolean;
  /** Raw scanned text; handled by ScanController (validation, de-duplication). */
  onScan: (data: string) => void;
  /** Torch on (native only; ignored where unsupported). */
  torch: boolean;
};
