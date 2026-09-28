import { WatermarkForm } from "@/components/admin/WatermarkForm";
import { Card, PageHeader } from "@/components/ui";
import { LocalTime } from "@/components/ui/LocalTime";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { capabilities } from "@/server/capabilities";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [watermark, audit] = await Promise.all([db.watermark.findFirst({ where: { isDefault: true } }), db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 60 })]);
  const caps = capabilities();
  const e = env();
  return (
    <>
      <PageHeader eyebrow="Configuration" title="Settings" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Preview watermark">
          <p className="mb-4 text-sm text-mist-400">Watermarks apply only to browser previews. Downloaded files remain clean.</p>
          <WatermarkForm initial={watermark ? { text: watermark.text, opacity: watermark.opacity, position: watermark.position, scale: watermark.scale } : null} />
        </Card>
        <Card title="Processing providers">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="eyebrow">Image</dt>
              <dd className="mt-1 text-mist-200">
                {caps.image.provider} {caps.image.isAi ? "(AI)" : "(classical, non-AI)"} {!caps.image.configured && <span className="text-coral-400">— API key missing</span>}
              </dd>
              <dd className="text-xs text-mist-400">{caps.image.description}</dd>
            </div>
            <div>
              <dt className="eyebrow">Video</dt>
              <dd className="mt-1 text-mist-200">{caps.video.provider === "replicate" ? "Replicate AI upscale + FFmpeg" : "FFmpeg (classical)"}</dd>
            </div>
            <div>
              <dt className="eyebrow">RAW</dt>
              <dd className="mt-1 text-mist-200">LibRaw (dcraw_emu / raw-identify) + ExifTool, 16-bit pipeline</dd>
            </div>
            <div>
              <dt className="eyebrow">Delivery</dt>
              <dd className="mt-1 text-mist-200">
                Expires {e.DELIVERY_TTL_HOURS} h after creation · download links valid {Math.round(e.DOWNLOAD_URL_TTL_SECONDS / 60)} min
              </dd>
            </div>
          </dl>
        </Card>
        <Card title="Audit log" className="xl:col-span-2" padded={false}>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-ink-700">
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-5 py-2 text-xs text-mist-400">
                    <LocalTime iso={a.createdAt} />
                  </td>
                  <td className="px-5 py-2 font-mono text-xs">{a.action}</td>
                  <td className="px-5 py-2 text-xs text-mist-400">{a.actorType}</td>
                  <td className="max-w-md truncate px-5 py-2 text-xs text-mist-400">{a.details ? JSON.stringify(a.details) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
