import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptics are a nicety: never let a failure surface to the user.
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  tap() {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  selection() {
    if (enabled) Haptics.selectionAsync().catch(() => {});
  },
  success() {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
};
