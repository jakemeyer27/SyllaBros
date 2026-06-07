import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill in your Neon connection string.');
}

export const sql = neon(process.env.DATABASE_URL);
