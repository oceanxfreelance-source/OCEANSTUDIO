import { z } from "zod";

/**
 * Centralised, validated environment access. Values are read lazily so that
 * build-time (next build) does not require production secrets.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  DELIVERY_ENCRYPTION_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),

  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_PUBLIC_ENDPOINT: z.string().url().optional(),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_REGION: z.string().default("auto"),
  STORAGE_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false"),

  REDIS_URL: z.string().optional(),
  QUEUE_URL: z.string().optional(),

  AI_IMAGE_PROVIDER: z.enum(["replicate", "classical"]).default("classical"),
  AI_VIDEO_PROVIDER: z.enum(["replicate", "ffmpeg"]).default("ffmpeg"),
  AI_IMAGE_API_KEY: z.string().optional(),
  AI_VIDEO_API_KEY: z.string().optional(),
  REPLICATE_MODEL_UPSCALE: z.string().default("nightmareai/real-esrgan"),
  REPLICATE_MODEL_RESTORE: z.string().default("megvii-research/nafnet"),
  REPLICATE_MODEL_VIDEO_UPSCALE: z.string().default("lucataco/real-esrgan-video"),
  REPLICATE_MAX_TILE_PIXELS: z.coerce.number().int().positive().default(1_440_000),

  EMAIL_PROVIDER_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(50 * 1024 ** 3),
  UPLOAD_PART_SIZE: z.coerce.number().int().min(5 * 1024 ** 2).default(64 * 1024 ** 2),
  DELIVERY_TTL_HOURS: z.coerce.number().positive().default(48),
  DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
  PREVIEW_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  ZIP_PART_MAX_BYTES: z.coerce.number().int().positive().default(4 * 1024 ** 3),
  WORKER_TMP_DIR: z.string().optional(),
  WORKER_CONCURRENCY_PHOTO: z.coerce.number().int().positive().default(2),
  WORKER_CONCURRENCY_VIDEO: z.coerce.number().int().positive().default(1),
  LOG_LEVEL: z.string().default("info"),
  TRUST_PROXY: z.enum(["true", "false"]).default("true"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper: forget cached env after process.env mutations. */
export function resetEnvCache(): void {
  cached = null;
}

export function redisUrl(): string | undefined {
  const e = env();
  return e.REDIS_URL ?? e.QUEUE_URL;
}

export const isProduction = () => env().NODE_ENV === "production";
