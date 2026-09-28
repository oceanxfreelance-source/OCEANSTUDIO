# OCEANX STUDIO

Professional RAW / photo / video enhancement, color grading and **private 48-hour client delivery** — built so that master files are never touched.

```
MASTER FILES ARE SACRED · RESTORE, DON'T REDESIGN · ORIGINALS ARE NEVER OVERWRITTEN
CLIENT DELIVERY IS TEMPORARY · DOWNLOADS PRESERVE THE SELECTED QUALITY
HEAVY PROCESSING RUNS IN WORKERS · SECURITY AND 48-HOUR EXPIRY ARE SERVER-SIDE
```

---

## 1. Architecture

```
                 ┌──────────────── Vercel (Next.js 15, App Router) ────────────────┐
 Admin (desktop) │  /admin UI · /api/admin/* · auth · validation · signed URLs      │
 Client (mobile) │  /gallery/[token] · /api/client/* · /api/cron/cleanup            │
                 └───────┬──────────────────────┬──────────────────────┬────────────┘
                         │ Prisma               │ BullMQ               │ presigned URLs only
                   ┌─────▼─────┐          ┌─────▼─────┐        ┌───────▼──────────────────┐
                   │PostgreSQL │          │  Redis    │        │ Private S3 bucket         │
                   │ + triggers│          │  queues   │        │ projects/…  (permanent)   │
                   └─────▲─────┘          └─────┬─────┘        │ deliveries/… (temporary)  │
                         │                      │              └───────▲──────────────────┘
                   ┌─────┴──────────────────────▼──────────────────────┴──────────┐
                   │ Worker (Docker): LibRaw · ExifTool · FFmpeg · libvips/sharp    │
                   │ ingest · RAW develop · AI/classical enhance · 8× · color ·     │
                   │ video · previews · delivery copies · ZIP · expiration sweep    │
                   └──────────────────────────┬───────────────────────────────────┘
                                              │ HTTPS (optional)
                                     AI providers (Replicate: NAFNet, Real-ESRGAN)
```

* **Browser → storage** directly for uploads (signed multipart) and downloads (short-lived signed GET). Large files never pass through Vercel.
* **Vercel** runs the web app, authentication, API orchestration and URL signing only.
* **Workers** do every heavy operation, asynchronously, and report progress to the database.

### Repository layout

| Path | Contents |
| --- | --- |
| `app/` | Next.js pages (`/admin/**`, `/gallery/[token]`) and API routes (`/api/admin/**`, `/api/client/**`, `/api/cron/cleanup`) |
| `components/` | UI (design system, admin workspace, compare viewer, uploader, client gallery) |
| `lib/` | env, auth (admin/client sessions), crypto, storage (keys + guarded S3 client), queue, rate limiting, audit, validation schemas, labels |
| `server/` | Domain services: uploads, media & publishing, jobs, deliveries, cleanup, stats |
| `services/` | Processing engines: `raw/` (LibRaw RawProcessor), `color/` (16-bit tone/color engine, presets), `image/` (pipeline, previews, export, strips), `ai/` (provider interfaces, Replicate, classical, fidelity guard), `video/` (FFmpeg), `zip/` |
| `workers/` | BullMQ worker entry, job lifecycle, handlers (ingest, photo, video, verify, delivery, zip) |
| `prisma/` | Schema, migrations (including master-immutability triggers), seed |
| `tests/` | `unit/`, `integration/` (real Postgres + Redis + S3 + LibRaw + FFmpeg), `e2e/` (Playwright), `fixtures/` (real Nikon NEF) |
| `scripts/` | `create-admin`, `configure-bucket-cors`, `run-cleanup` |

## 2. Installation

Requirements: Node 22, PostgreSQL 14+, Redis 6+, an S3-compatible bucket, and for the worker: `libraw-bin` (`dcraw_emu`, `raw-identify`), `libimage-exiftool-perl`, `ffmpeg` (with `vidstab`).

```bash
npm install
cp .env.example .env        # fill in the values (see §3)
npm run db:migrate          # prisma migrate deploy
npm run db:seed             # optional demo clients/projects + presets (no real customer data)
ADMIN_EMAIL=you@studio.com ADMIN_PASSWORD='a-long-passphrase' ADMIN_NAME='You' npm run admin:create
npm run storage:cors        # browser upload/download CORS on the bucket
```

## 3. Environment variables

All variables are documented in [`.env.example`](.env.example). The important ones:

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Public URL. `https://` enables `__Host-` secure cookies. Used for gallery links & CSRF origin checks. |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | ≥32 chars. Keys token hashing (HMAC) and, unless `DELIVERY_ENCRYPTION_KEY` is set, AES-GCM encryption of delivery link/password |
| `CRON_SECRET` | Bearer token for `/api/cron/cleanup` (Vercel Cron) |
| `STORAGE_*` | Private S3-compatible bucket (endpoint, bucket, keys, region, path-style) |
| `REDIS_URL` / `QUEUE_URL` | BullMQ queue + distributed rate limiting |
| `AI_IMAGE_PROVIDER`, `AI_IMAGE_API_KEY` | `classical` (default, non-AI) or `replicate` |
| `AI_VIDEO_PROVIDER`, `AI_VIDEO_API_KEY` | `ffmpeg` (default) or `replicate` |
| `REPLICATE_MODEL_*` | Model references (`owner/name` or `owner/name:version`) |
| `DELIVERY_TTL_HOURS` | 48 (the product rule; change only for testing) |
| `DOWNLOAD_URL_TTL_SECONDS` | 600 (5–15 min recommended) |

Never commit `.env`. No credentials exist in source code; the first admin is created from environment variables by `npm run admin:create`.

## 4. Database setup

PostgreSQL + Prisma. Tables: `admin_users`, `sessions`, `clients`, `projects`, `project_access`, `media_files`, `media_metadata`, `media_versions`, `processing_jobs`, `processing_presets`, `deliveries`, `delivery_files`, `delivery_packages`, `storage_objects`, `downloads`, `favorites`, `watermarks`, `audit_logs`, `app_settings`.

The migration `master_immutability` installs **database triggers** as defence in depth:

* `media_files.storage_key` can never change; `checksum` and `size` are immutable once recorded; an ingested master row cannot be deleted.
* `media_versions` rows cannot be deleted and their stored content fields (`storage_key`, `checksum`, `size`, `version_type`) cannot change.

## 5. Storage setup

Use a **private** bucket on Cloudflare R2, AWS S3 or Backblaze B2 (public access disabled, no public bucket policy).

```
projects/{projectId}/masters/{fileId}                 permanent · written once after validation
projects/{projectId}/raw-previews/{fileId}.jpg        permanent
projects/{projectId}/previews/{fileId}/{variant}      permanent
projects/{projectId}/previews/versions/{versionId}/…  permanent
projects/{projectId}/versions/{mediaId}/{versionId}   permanent (derivatives)
deliveries/{deliveryId}/files/{fileId}                temporary
deliveries/{deliveryId}/previews/{fileId}/{variant}   temporary
deliveries/{deliveryId}/packages/{packageId}.zip      temporary
deliveries/{deliveryId}/manifest.json                 temporary
uploads/{mediaId}                                     staging (validated → promoted → deleted)
processing/{jobId}/…                                  worker scratch
```

1. Create the bucket and keys with read/write/delete/list permissions on it.
2. `npm run storage:cors` — allows `PUT`/`GET` from `APP_URL` and **exposes the `ETag` header** (required for multipart uploads).
3. Recommended: enable **bucket versioning** and/or **object lock** on `projects/*/masters/` and a lifecycle rule that aborts incomplete multipart uploads after 7 days. For R2 set `STORAGE_REGION=auto`; for local S3 emulators set `STORAGE_FORCE_PATH_STYLE=true`. If the browser reaches storage on a different host than the server (Docker), set `STORAGE_PUBLIC_ENDPOINT`.

## 6. Queue setup

Any Redis-compatible server (Redis, Upstash Redis with TCP, Valkey, ElastiCache). Queues: `oceanx-photo`, `oceanx-video`, `oceanx-delivery`, `oceanx-maintenance`. The database is the source of truth for jobs; queue messages only carry the job id. The same Redis also backs rate limiting across serverless instances.

## 7. AI provider setup

Provider interfaces live in `services/ai/types.ts`:

```ts
interface ImageEnhancementProvider { capabilities(): ProviderCapabilities; enhance(input: ProcessingInput, settings: EnhancementStep): Promise<ProcessingResult> }
interface VideoEnhancementProvider { enhance(input: VideoProcessingInput, settings: VideoEnhancementSettings): Promise<ProcessingResult> }
```

| Provider | Operations | Label |
| --- | --- | --- |
| `classical` (default) | chroma/luma noise reduction, unsharp-mask focus & detail recovery, natural sharpening, Lanczos-3 2×/4× (8× = 4×→2×) | `ENHANCED`, `ENHANCED 8×` — **never** “AI” |
| `replicate` | NAFNet denoise / motion deblur / defocus, Real-ESRGAN super resolution & detail recovery, tiled with overlap and seamless stitching | `AI ENHANCED`, `AI ENHANCED 8×` |

To enable AI: `AI_IMAGE_PROVIDER=replicate`, `AI_IMAGE_API_KEY=<replicate token>`; optionally pin model versions via `REPLICATE_MODEL_UPSCALE`, `REPLICATE_MODEL_RESTORE` (`owner/name:versionhash`). Video: `AI_VIDEO_PROVIDER=replicate` (+ `AI_VIDEO_API_KEY`) and `REPLICATE_MODEL_VIDEO_UPSCALE`.

Operations a provider cannot perform (e.g. motion deblur with the classical engine, video deblur) are **disabled in the UI and rejected by the worker with a clear message** — never simulated.

**Face preservation (RESTORE, DON'T REDESIGN)** is ON by default. Generative face restoration (GFPGAN) is never enabled while it is on, and every restoration/upscale step is checked by the structural fidelity guard (`services/ai/fidelity.ts`): low-pass SSIM globally, per block, and per face region (from camera face-detect metadata or XMP regions). A step that deviates is blended back 50 %; if it still deviates the job fails and nothing is saved.

## 8. Worker setup

```bash
npm run worker                       # local (tools must be on PATH)
docker build -f Dockerfile.worker -t oceanx-worker .
docker run --env-file .env -v /data/oceanx-work:/work oceanx-worker
```

The worker checks for `dcraw_emu`, `raw-identify`, `exiftool`, `ffmpeg`, `ffprobe` at start-up. Scratch space (`WORKER_TMP_DIR`, `/work` in Docker) must hold several times the largest output (an 8× 16-bit TIFF of a 24 MP file is ≈ 2.3 GB). Tune `WORKER_CONCURRENCY_PHOTO` / `WORKER_CONCURRENCY_VIDEO` to CPU & RAM. Run as many worker replicas as you like — jobs are claimed atomically.

## 9. Local development

```bash
docker compose up -d postgres redis s3     # or local services
# .env: STORAGE_ENDPOINT=http://127.0.0.1:9000 STORAGE_FORCE_PATH_STYLE=true REDIS_URL=redis://127.0.0.1:6379
npm run storage:cors -- --create
npm run dev          # http://localhost:3000/admin
npm run worker       # second terminal
```

## 10. Production deployment

1. Provision PostgreSQL (Neon, RDS, Supabase…), Redis, the private bucket.
2. Deploy the web app to Vercel (§11) and the worker container anywhere (§12).
3. `npm run admin:create` once against the production database; remove `ADMIN_*` variables afterwards.
4. Configure bucket CORS for your production domain (`APP_URL=https://studio.example npm run storage:cors`).

## 11. Vercel deployment

* Import the repository; framework **Next.js**. `vercel.json` runs `prisma generate && prisma migrate deploy && next build`.
* Set all web variables from §3 (the web app does not need AI keys or tool binaries).
* `vercel.json` registers a **Cron** calling `/api/cron/cleanup` every 10 minutes; Vercel sends `Authorization: Bearer $CRON_SECRET`.
* Nothing heavy runs on Vercel: uploads/downloads are direct to storage, processing is queued.

## 12. Background worker deployment

Deploy `Dockerfile.worker` to Fly.io, Railway, Render, ECS/Fargate, Kubernetes or a VM with the same environment as the web app (plus AI keys). Give it a persistent/ephemeral volume at `/work`, enough RAM (4–8 GB for 8× work) and allow outbound HTTPS to storage and AI providers. Scale horizontally by adding replicas.

## 13. Storage lifecycle

| Stage | What happens |
| --- | --- |
| Upload | Browser uploads multipart directly to `uploads/{mediaId}`. On completion the server checks size and **magic bytes** (never trusting filename or MIME). Invalid uploads are rejected and the staging object deleted. |
| Ingest (worker) | Server-side copy to `projects/…/masters/{id}` (only if absent), **SHA-256 of the master**, metadata (LibRaw/ExifTool/FFprobe), previews; staging deleted; `ORIGINAL` version created referencing the master. |
| Processing | Every operation writes a **new** object under `versions/` and a new `media_versions` row. Before finalising, the master is re-verified (SHA-256 for files ≤ 4 GB, size+ETag otherwise; full hash on demand via “Verify checksum”). Mismatch ⇒ job fails + `INTEGRITY_ALERT`. |
| Delivery | Published versions are server-side copied into `deliveries/{id}/…` with previews (optionally watermarked) and an optional ZIP; a manifest pins exact version ids and checksums. |
| Expiry | Temporary prefix deleted; masters and derivatives are untouched. |

Every object written is registered in `storage_objects` (category, size, temporary flag), which powers the Storage dashboard.

## 14. Client delivery expiration

* `expires_at = created_at + 48 h` is stored on the delivery; the client countdown is display-only.
* **Every** client request (page render, gallery, media, favorite, download, login) evaluates `current_time >= expires_at` on the server and returns *410 Gone* / the “GALLERY EXPIRED” page — it does not wait for cleanup.
* Client sessions are bound to one delivery and expire with it; revocation invalidates them immediately.
* Cleanup (`server/cleanup.ts`, run by the worker every minute **and** Vercel Cron every 10 minutes): mark `EXPIRED` → revoke sessions → `DELETING` → delete registered temporary objects + everything under `deliveries/{id}/` → verify the prefix is empty → `DELETED`. It is idempotent, lease-protected against concurrent runners, logged to the audit log, and failures are recorded and retried on the next sweep.
* **It can never delete a master**: every key goes through `assertDeletable()`, which rejects anything under `projects/`, any `/masters/` segment and anything outside `deliveries/{thisDeliveryId}/`; the storage client has no other delete path, and database triggers protect master rows.
* “Create new 48-hour delivery” re-uses the permanent versions — no re-upload.

## 15. RAW processing

Nikon **NEF** (and DNG, CR2, CR3, ARW, RAF, ORF, RW2) are first-class RAW masters.

```
NEF MASTER → RAW METADATA (raw-identify + ExifTool) → RAW DECODE (LibRaw, linear 16-bit, AHD, highlight blend/rebuild,
optional wavelet denoise) → RAW DEVELOPMENT (OCEANX 16-bit engine: WB in Kelvin/tint, exposure, highlights, shadows,
whites, blacks, contrast, saturation, vibrance, clarity, dehaze, sharpening, detail) → AI ENHANCEMENT → SUPER RESOLUTION
→ COLOR GRADING → FINAL DERIVATIVE (16-bit TIFF / 8-bit TIFF / 16-bit PNG / 4:4:4 JPEG, sRGB ICC, camera EXIF copied)
```

RAW settings are stored as JSON on the version; the NEF is only ever read. Previews use the camera’s embedded full-size JPEG when present, otherwise a real half-size LibRaw decode. The engine sits behind the `RawProcessor` interface (`services/raw/types.ts`) so another decoder can be swapped in. Large images (8×) are graded in horizontal strips so memory stays bounded.

## 16. Security

* Admin auth: scrypt password hashes, DB-backed sessions (HMAC-hashed tokens), `HttpOnly` + `SameSite=Lax` (+ `Secure`, `__Host-` on HTTPS) cookies, 12-hour expiry, constant-time login.
* Client auth: private 32-char token URL **and** password (scrypt); per-gallery session cookie bound to that delivery and capped at its expiry. Token and password are stored hashed for verification and AES-256-GCM-encrypted only so the admin can copy them again.
* Every admin API verifies the session in the database; every client API verifies token → delivery → not revoked → not expired → session → resource ∈ delivery (and version still published).
* CSRF: Origin/`Sec-Fetch-Site` checks on all state-changing requests + SameSite cookies.
* Rate limiting (Redis): admin login, client login (per IP and per gallery), gallery access, downloads, processing, upload initialisation.
* Validation: zod schemas on every input; extension allow-list + magic-byte verification; upload size limits; decompression-bomb pixel limit for uploaded images.
* Headers: CSP with per-request nonce, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`; `noindex` everywhere (and `X-Robots-Tag`, `robots.txt` disallow).
* Storage is private; all access is via short-lived signed URLs (downloads 10 min, previews 15 min).
* Audit log: LOGIN, PROJECT_CREATED, FILE_UPLOADED, PROCESSING_STARTED/COMPLETED/FAILED, FILE_PUBLISHED/UNPUBLISHED, DELIVERY_CREATED/REVOKED/EXPIRED/DELETED, DOWNLOAD, INTEGRITY_ALERT and more.

## 17. Testing

```bash
npm run lint && npm run typecheck
npm test                    # unit: crypto, key guards, file validation, labels, color engine, presets, expiry logic, ZIP/tiling, fidelity guard, mocked Replicate
npm run test:integration    # real Postgres + Redis + S3 (moto) + LibRaw + FFmpeg
npm run build && npm run test:e2e   # Playwright: admin desktop flow + client on iPhone viewport
```

Integration and E2E runs create a **fresh, uniquely named database** per run (`CREATE DATABASE`, `prisma migrate deploy`) and drop only that database afterwards; S3 is emulated with `moto_server` (`pip install "moto[server]"`) if no endpoint is reachable. Override with `TEST_DATABASE_URL`, `TEST_STORAGE_ENDPOINT`, `TEST_REDIS_URL`.

| Acceptance test (spec) | Where |
| --- | --- |
| §91 Critical master test (NEF → SHA-256 → 8× → grade → publish → deliver → download → expire → cleanup → NEF unchanged → new delivery) | `tests/integration/critical-master.test.ts` (real Nikon D1 NEF) |
| §68 Expiration test | `tests/integration/expiration.test.ts` |
| §70 Security tests | `tests/integration/security.test.ts` |
| §90 Photo / RAW / Video / Delivery | `photo.test.ts`, `critical-master.test.ts`, `video.test.ts`, `tests/e2e/*.spec.ts` |
| Upload validation & resume | `tests/integration/uploads.test.ts` |

`tests/fixtures/nikon_d1.NEF` is a real CC0 sample from raw.pixls.us. With the default classical provider the 8× critical test takes ≈3–4 minutes on 4 cores.

---

### Honest limits

* The default engine is **classical, not AI**; outputs are labelled accordingly. AI restoration requires a configured provider (Replicate integration included). AI models can reconstruct plausible detail but cannot guarantee detail that was never captured — the UI says so for deblur/focus recovery and for *Maximum* quality.
* Video motion deblur is not offered (no provider configured for it); AI video upscale requires the Replicate video provider.
* Temperature/tint for RAW use a black-body model relative to a daylight-balanced decode; “as-shot” uses the camera’s white balance.
* The 100 % inspection view uses an inspection image of up to 8192 px; for larger derivatives the viewer states the effective resolution — download the file for pixel-exact review.
