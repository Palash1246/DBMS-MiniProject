import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env.local if present, else .env
dotenv.config({ path: '.env.local' });
dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid postgres connection string'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB: z.string().default('parksmart'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  CRON_SECRET: z.string().min(8, 'CRON_SECRET must be at least 8 characters long'),
  NEXT_PUBLIC_DEFAULT_LAT: z.coerce.number().default(12.9756),
  NEXT_PUBLIC_DEFAULT_LNG: z.coerce.number().default(77.6068),
});

const adminEnvSchema = envSchema.extend({
  DATABASE_ADMIN_URL: z.string().url('DATABASE_ADMIN_URL is required for admin scripts'),
  MONGODB_ADMIN_URI: z.string().min(1, 'MONGODB_ADMIN_URI is required for admin scripts'),
  PS_APP_PASSWORD: z.string().min(1, 'PS_APP_PASSWORD is required for migration'),
  SEED_PASSWORD: z.string().default('ChangeMe#2026'),
});

function validateEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid application environment variables:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    throw new Error('Invalid application environment variables');
  }
  return parsed.data;
}

export function validateAdminEnv() {
  const parsed = adminEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid admin/script environment variables:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    throw new Error('Invalid admin/script environment variables');
  }
  return parsed.data;
}

export const env = (process.env.NODE_ENV === 'test' || process.env.SKIP_ENV_VALIDATION === 'true')
  ? (process.env as unknown as z.infer<typeof envSchema>)
  : validateEnv();
