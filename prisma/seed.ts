/**
 * Development seed: generic demo clients & projects and the built-in presets.
 * No real customer data, no media (upload real files through the UI).
 */
import { db } from "@/lib/db";
import { PRESETS } from "@/services/color/presets";

async function main() {
  const clients = [
    { name: "Demo Client — Surf", email: "surf.client@example.com" },
    { name: "Demo Client — Wedding", email: "wedding.client@example.com" },
    { name: "Demo Client — Events", email: "events.client@example.com" },
  ];
  const created = [];
  for (const c of clients) {
    const existing = await db.client.findFirst({ where: { email: c.email } });
    created.push(existing ?? (await db.client.create({ data: c })));
  }
  const projects = [
    { name: "Surf Session", client: 0 },
    { name: "Wedding Collection", client: 1 },
    { name: "Drone Footage", client: 0 },
    { name: "Outdoor Portrait", client: 1 },
    { name: "Event Photography", client: 2 },
  ];
  for (const p of projects) {
    if (await db.project.findFirst({ where: { name: p.name } })) continue;
    const clientId = created[p.client]!.id;
    await db.project.create({ data: { name: p.name, clientId, shootDate: new Date(), access: { create: { clientId } } } });
  }
  for (const preset of Object.values(PRESETS)) {
    await db.processingPreset.upsert({
      where: { kind_name: { kind: "COLOR", name: preset.name } },
      create: { kind: "COLOR", name: preset.name, settings: JSON.parse(JSON.stringify(preset)), builtIn: true },
      update: { settings: JSON.parse(JSON.stringify(preset)) },
    });
  }
  if (!(await db.watermark.findFirst({ where: { isDefault: true } }))) {
    await db.watermark.create({ data: { text: "OCEANX STUDIO", opacity: 0.35, position: "center", scale: 0.05, isDefault: true } });
  }
  console.log("Seed complete. Create an admin with: npm run admin:create");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
