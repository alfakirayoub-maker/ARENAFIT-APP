export type ShareOutcome = 'shared' | 'dismissed' | 'copied';

/** Web preview: Web Share API when available, else copy to the clipboard. */
export async function shareText(message: string): Promise<ShareOutcome> {
  const nav = globalThis.navigator as Navigator | undefined;
  if (nav?.share) {
    try {
      await nav.share({ text: message });
      return 'shared';
    } catch {
      return 'dismissed';
    }
  }
  await nav?.clipboard?.writeText(message).catch(() => {});
  return 'copied';
}

export async function shareOnWhatsApp(message: string): Promise<ShareOutcome> {
  globalThis.open?.(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  return 'shared';
}
