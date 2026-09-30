# OCEAN X

**Ocean & Visual Media from Laamu, Maldives.**

This repository holds two things:

1. **The public website.** Visitors see Ocean X's work, services and Laamu locations, then send a booking request. Visitors never register or log in.
2. **The private Superadmin** at `/superadmin`. Only the Ocean X owner uses it, to manage the website and the business.

```
PUBLIC   Visitor → Website → Our Work / Services / Laamu → Book a session → Ocean X replies
PRIVATE  Owner   → /superadmin login → Dashboard → Bookings · Sessions · Customers · Content
```

---

## What's inside

| Public page | What it shows |
| --- | --- |
| `/` Home | Cinematic hero, intro, selected work, services, Laamu, testimonials, call to action |
| `/work` | Portfolio with category filter (Surf, Ocean, Laamu, Travel, Commercial, Resort, Photography, Videography) |
| `/services` | Services from the database: **Active** and **Coming soon** |
| `/laamu` | Locations (Machines, islands, lagoons…) managed from the admin |
| `/about`, `/contact` | Editable text and contact details |
| `/book` | Booking request form. No account; spam-protected and rate-limited |

| Superadmin section | What you can do |
| --- | --- |
| Dashboard | New requests, confirmed bookings, upcoming and completed sessions, revenue, services, recent customers and uploads |
| Bookings | See every request, change its status (New → Contacted → Confirmed → Completed / Cancelled), set price and payment, add private notes, reply in one click on WhatsApp, Instagram or email |
| Sessions & delivery | Create a session from a booking, record clips, price and payment, paste a Google Drive delivery link, send it on WhatsApp or email, mark it sent |
| Customers | Private customer records (created automatically from bookings), with session count, total spent, and first and last booking |
| Services | Add or edit services, switch **Coming soon → Active** in one click, set prices, images and display order |
| Portfolio | Add work with photos and a YouTube, Vimeo or MP4 link, then feature, publish or unpublish it |
| Laamu locations | Add, edit, feature or publish places |
| Testimonials | Real customer quotes; featured ones appear on the home page |
| Website content | Hero text and image, about text, contact details, Instagram, footer, SEO description |
| Account | Change your password and sign out all devices |

## Technology

- **Next.js 15** (React, App Router, server actions): pages and admin in one app, hosted on **Vercel**.
- **PostgreSQL** via **Prisma**: hosted on **Neon** (free tier).
- **Tailwind CSS** for styling, and **zod** for validating every form.
- **sharp**: uploaded photos are resized, converted to WebP, and have camera and GPS data removed.
- Images are stored in the database for version 1, so no extra service is needed. The `MediaAsset.storage` field is there so they can move to S3 or R2 later without other changes.

## Security

- **One private admin login.** There is no registration page; admins are only created with a command (see below).
- Passwords are **scrypt-hashed**. Nothing secret is stored in frontend code.
- **Server-side sessions:**
  - The browser holds a random token in an HttpOnly cookie.
  - The database stores only the token's hash.
  - Sessions expire after 7 days.
- **Every** admin page and admin action checks the session in the database (`requireAdmin()`). Keeping the `/superadmin` URL secret is **not** part of the protection.
- **Rate limiting:**
  - Login attempts: 10 per 15 minutes.
  - Booking requests: 6 per hour.
- The booking form uses a hidden honeypot field to stop spam bots.
- **Input validation** on every form, plus security headers (CSP, clickjacking protection, HSTS).
- Admin pages are marked `noindex`, and public queries only ever read published content.

## Run it on your computer

You need Node.js 22 and a PostgreSQL database. The free Neon database works.

```bash
npm install
cp .env.example .env            # then put your DATABASE_URL in .env
npx prisma migrate deploy       # create the tables
npm run db:seed                 # starter services + Laamu places (runs once)
npm run admin:create -- you@example.com "Your Name"   # asks for a password
npm run dev                     # open http://localhost:3000
```

The admin is at **http://localhost:3000/superadmin**.

## Deploying (Vercel + Neon)

1. In Vercel, set these environment variables:
   - `DATABASE_URL`: your Neon connection string.
   - `SITE_URL` (optional): your domain.
2. Every deploy runs `prisma migrate deploy` and the one-time seed, then builds (see `vercel.json`).
3. Create the admin once. Either:
   - run `npm run admin:create` locally with `DATABASE_URL` pointing at the production database, or
   - ask Claude Code to do it.

## Tests

```bash
npm test                 # unit + database tests (validation, customer matching, passwords…)
npm run build && npm start
npx playwright test      # browser tests: booking flow, admin, services, portfolio upload, content, mobile
```

The browser tests sign in with `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`. GitHub Actions runs everything on each push (`.github/workflows/ci.yml`).

## Project layout

```
app/(site)/            public pages (home, work, services, laamu, about, contact, book)
app/superadmin/        login + private admin panel
app/api/admin/media    admin-only image upload
app/media/[id]         serves optimised images (cached for a year)
components/site        public UI (header, cards, video player…)
components/admin       admin UI (forms, tables, image picker)
lib/                   database, auth, validation, content defaults, helpers
prisma/                database schema, migrations, starter content
scripts/create-admin   the only way to create an admin
tests/                 unit tests + Playwright browser tests
```

### Making changes

- **Website text:** edit it in Superadmin → Website content. To add a *new* editable text, add one entry to `CONTENT_FIELDS` in `lib/content.ts` and it appears in the admin automatically.
- **Portfolio categories or location types:** edit the lists in `lib/constants.ts`.
- **Colours and fonts:** edit `app/globals.css` (the `@theme` block).

## Ready for later

The data model is designed so these can be added without rebuilding:

- **Staff accounts:** `AdminUser.role` already supports OWNER / STAFF.
- **Online payments and invoices:** bookings and sessions already store a price and a payment status.
- **Email or WhatsApp notifications:** hook into `createBookingRequest()` in `lib/bookings.ts`.
- **Private customer galleries:** sessions already hold a delivery link and delivery status.
- **Maldives-wide locations:** locations already have an `atoll` field.
- **Calendar and availability, revenue reports:** sessions store date, time and status.
