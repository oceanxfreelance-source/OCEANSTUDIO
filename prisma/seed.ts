/**
 * Starter content: the current services and our two places — Machines and Maabaidhoo.
 * Runs only ONCE per database (remembered in the settings table), so it's safe
 * in every deploy: anything you later edit or delete is never re-created.
 * No fake portfolio items or testimonials are created; add real ones in /superadmin.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const services = [
  {
    slug: "drone-videography",
    name: "Drone Videography",
    status: "ACTIVE" as const,
    featured: true,
    displayOrder: 1,
    shortDescription: "Aerial surf films of your waves at Machines.",
    description:
      "Cinematic aerial footage of your surf session at Machines, Maabaidhoo — filmed from above the wave.\n\nTell us when you're surfing and we'll plan the flight around the conditions and the light. You receive your edited clips and original files by private download link.",
  },
  {
    slug: "sea-photography",
    name: "Sea Photography",
    status: "COMING_SOON" as const,
    displayOrder: 2,
    shortDescription: "Photographs of the ocean, boats and island life.",
    description: "Still photography of the sea, the islands and the people who live and travel here.",
  },
  {
    slug: "surf-photography",
    name: "Surf Photography",
    status: "COMING_SOON" as const,
    displayOrder: 3,
    shortDescription: "Sharp action photos of your waves.",
    description: "Surf photography from the channel and the line-up — every wave of your session, captured.",
  },
  {
    slug: "water-photography",
    name: "Water Photography",
    status: "COMING_SOON" as const,
    displayOrder: 4,
    shortDescription: "In-water photography, eye level with the wave.",
    description: "Photography from in the water — close to the action, eye level with the wave.",
  },
];

const locations = [
  { slug: "machines", name: "Machines", kind: "Surf spot", featured: true, displayOrder: 1, description: "One of Laamu's best-known surf breaks — and where Ocean X began, with a drone above the waves." },
  { slug: "maabaidhoo", name: "Maabaidhoo", kind: "Island", featured: true, displayOrder: 2, description: "Our island in Laamu Atoll — home base for every Ocean X session at Machines." },
];

async function main() {
  const done = await db.setting.findUnique({ where: { key: "system.seeded" } });
  if (done && !process.argv.includes("--force")) {
    console.log("✔ Starter content already added earlier — skipping.");
    return;
  }
  for (const s of services) {
    await db.service.upsert({ where: { slug: s.slug }, create: { ...s, priceType: "ON_REQUEST", published: true }, update: {} });
  }
  for (const l of locations) {
    await db.location.upsert({ where: { slug: l.slug }, create: { ...l, atoll: "Laamu", published: true }, update: {} });
  }
  await db.setting.upsert({ where: { key: "system.seeded" }, create: { key: "system.seeded", value: new Date().toISOString() }, update: {} });
  console.log(`✔ Seeded ${services.length} services and ${locations.length} locations (existing ones left unchanged).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
