const TOKEN_KEY = 'syllabros_token';
const USER_KEY  = 'syllabros_user';

export interface SessionUser { id: string; name: string; email: string; }

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): SessionUser | null {
  try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'); } catch { return null; }
}

export function storeAuth(token: string, user: SessionUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function getJWTToken(): Promise<string | null> {
  return getStoredToken();
}

export async function signUp(name: string, email: string, password: string): Promise<SessionUser> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Sign up failed');
  storeAuth(data.token, data.user);
  return data.user;
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const res = await fetch('/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Sign in failed');
  storeAuth(data.token, data.user);
  return data.user;
}

export async function getSession(): Promise<SessionUser | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.user) { clearAuth(); return null; }
    return data.user;
  } catch {
    return null;
  }
}
