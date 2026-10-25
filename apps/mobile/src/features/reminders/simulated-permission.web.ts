import type { PermissionState } from './types';

/**
 * Web preview only: the notification permission the simulated scheduler
 * reports. Switchable from Profil › Développement to review the explanation
 * and "denied" screens without a phone. Kept in localStorage so it survives
 * page reloads during review.
 */
const KEY = 'arenafit:dev:simulated-notification-permission';
const listeners = new Set<() => void>();

function read(): PermissionState {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    return v === 'granted' || v === 'denied' ? v : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

let state: PermissionState = read();

export function getSimulatedPermission(): PermissionState {
  return state;
}

export function setSimulatedPermission(next: PermissionState) {
  state = next;
  try {
    globalThis.localStorage?.setItem(KEY, next);
  } catch {
    // storage unavailable: keep the in-memory value
  }
  listeners.forEach((l) => l());
}

export function subscribeSimulatedPermission(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
