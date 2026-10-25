import * as SecureStore from 'expo-secure-store';

/**
 * Small secrets on this device (Keychain / Android Keystore). Keys may only
 * contain letters, digits, ".", "-" and "_".
 */
export const secureKv = {
  get: (key: string): Promise<string | null> => SecureStore.getItemAsync(key),
  set: (key: string, value: string): Promise<void> => SecureStore.setItemAsync(key, value),
  remove: (key: string): Promise<void> => SecureStore.deleteItemAsync(key),
};
