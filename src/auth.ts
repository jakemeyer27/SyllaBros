import { createInternalNeonAuth } from '@neondatabase/auth';

const url = import.meta.env.VITE_NEON_AUTH_URL as string;

if (!url) {
  console.warn('VITE_NEON_AUTH_URL is not set — add it to .env.local');
}

// createInternalNeonAuth gives us both the auth client AND getJWTToken()
// getJWTToken() produces a short-lived signed JWT — the right way to auth
// against a separate API server.
const neonAuth = createInternalNeonAuth(url);

export const authClient = neonAuth.adapter;
export const getJWTToken = () => neonAuth.getJWTToken();
