import { Linking, Share } from 'react-native';

export type ShareOutcome = 'shared' | 'dismissed' | 'copied';

/** Native share sheet (WhatsApp, Messages, Instagram…). */
export async function shareText(message: string): Promise<ShareOutcome> {
  const result = await Share.share({ message });
  // Android always reports sharedAction; iOS reports dismissedAction on cancel.
  return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
}

/** Opens WhatsApp with the message (wa.me works without declaring URL schemes). */
export async function shareOnWhatsApp(message: string): Promise<ShareOutcome> {
  await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
  return 'shared';
}
