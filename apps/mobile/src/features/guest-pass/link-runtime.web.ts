import { createLocalLinkService, type InvitationLinkService } from './link-service';
import { linkConfig } from './link-config';

/** Web preview: no Branch SDK; links open /invite/<token> directly. */
export const invitationLinks: InvitationLinkService = createLocalLinkService(linkConfig);

export { linkConfig };
