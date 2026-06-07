/**
 * Builds the full API URL for a given path.
 *
 * In development:  VITE_API_URL is unset → resolves to "/api/…"
 *                  which Vite's dev-server proxy forwards to localhost:3001.
 *
 * In production:   VITE_API_URL="https://syllabros-api.up.railway.app"
 *                  so requests go directly to the deployed Express server.
 *
 * Set VITE_API_URL in your Vercel project's Environment Variables dashboard.
 */
export function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_URL ?? '';
  return `${base}${path}`;
}
