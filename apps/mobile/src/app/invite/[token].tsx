import { useLocalSearchParams } from 'expo-router';

import { InvitationPreview } from '@/features/guest-pass/components/InvitationPreview';
import { isShareToken } from '@/features/guest-pass/links';

/** /invite/<token> — opened from an invitation link (validated by +native-intent and here). */
export default function InviteByTokenScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <InvitationPreview invitation={isShareToken(token) ? { kind: 'token', token } : null} />;
}
