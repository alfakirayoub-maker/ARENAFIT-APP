import type { PermissionState } from './types';

/**
 * Native builds: there is no simulated permission (the real OS answers).
 * The web preview implementation lives in ./simulated-permission.web.ts.
 */
export function getSimulatedPermission(): PermissionState {
  return 'unavailable';
}

export function setSimulatedPermission(_next: PermissionState) {}

export function subscribeSimulatedPermission(_listener: () => void) {
  return () => {};
}
