import { Router } from 'express';
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { neon } from '@neondatabase/serverless';

const router = Router();

const secret = () => new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'syllabros-default-secret-set-in-prod'
);

const db = () => neon(process.env.DATABASE_URL!);

function hashPw(pw: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function checkPw(pw: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const derived = scryptSync(pw, salt, 64);
  return timingSafeEqual(Buffer.from(hash, 'hex'), derived);
}

async function makeToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret());
}

router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return; }
  const sql = db();
  try {
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length) { res.status(400).json({ error: 'Email already registered' }); return; }
    const [user] = await sql`
      INSERT INTO users (name, email, password_hash)
      VALUES (${name ?? ''}, ${email}, ${hashPw(password)})
      RETURNING id, name, email`;
    res.json({ token: await makeToken(user.id), user });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.post('/signin', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return; }
  const sql = db();
  try {
    const [user] = await sql`SELECT id, name, email, password_hash FROM users WHERE email = ${email}`;
    if (!user || !checkPw(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password' }); return;
    }
    res.json({ token: await makeToken(user.id), user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.get('/session', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) { res.json({ user: null }); return; }
  try {
    const { payload } = await jwtVerify(header.slice(7), secret());
    const sql = db();
    const [user] = await sql`SELECT id, name, email FROM users WHERE id = ${payload.sub}`;
    res.json({ user: user ?? null });
  } catch { res.json({ user: null }); }
});

export default router;
