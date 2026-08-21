import { createInternalNeonAuth } from '@neondatabase/auth';

// In dev: call Neon Auth directly (localhost is always trusted).
// In production: route through our /api/neon-auth proxy to bypass CORS/origin checks.
const url = import.meta.env.DEV
  ? (import.meta.env.VITE_NEON_AUTH_URL as string)
  : `${window.location.origin}/api/neon-auth`;

const neonAuth = createInternalNeonAuth(url);

export const authClient = neonAuth.adapter;
export const getJWTToken = () => neonAuth.getJWTToken();
