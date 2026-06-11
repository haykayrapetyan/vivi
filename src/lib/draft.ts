// Shared between client and server: a landing-page vacancy draft is stashed in
// this cookie when an unauthenticated visitor submits the hero composer, then
// picked up on /app after they sign in (see LandingHero / DraftResume).
export const DRAFT_COOKIE = "vivi_draft";
export const MAX_DRAFT_LEN = 2000;
