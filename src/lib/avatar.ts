import "server-only";

/** R2 key for a user avatar. */
export const avatarKey = (userId: string) => `avatars/${userId}`;

/** App-relative URL the <img>/Avatar tags use; the route redirects to a signed
 * R2 URL. The version query busts caches after a re-upload. */
export const avatarUrl = (userId: string) =>
  `/api/media/avatar/${userId}?v=${Date.now()}`;
