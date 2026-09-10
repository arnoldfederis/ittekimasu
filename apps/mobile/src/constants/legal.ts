/**
 * The hosted legal pages.
 *
 * Hosted rather than in-app screens because App Store Connect needs a public privacy URL
 * to accept a submission at all. They live in the marketing site repo
 * (~/Projects/ittekimasu-site), so a copy change there needs no app release.
 *
 * Centralised because App Review checks these in two separate places — the paywall and the
 * sign-in screen — and a base URL that drifted between them would leave one of them 404ing
 * on the exact screen a reviewer is inspecting.
 */
export const LEGAL_BASE_URL = "https://ittekimasu.app";

export const PRIVACY_URL = `${LEGAL_BASE_URL}/privacy`;
export const TERMS_URL = `${LEGAL_BASE_URL}/terms`;
export const SUPPORT_URL = `${LEGAL_BASE_URL}/support`;
