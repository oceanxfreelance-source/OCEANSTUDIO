"use client";

import { useState } from "react";
import { Alert, Button, Field, Input, Select, Slider } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";

export function WatermarkForm({ initial }: { initial: { text: string; opacity: number; position: string; scale: number } | null }) {
  const [w, setW] = useState(initial ?? { text: "OCEANX STUDIO", opacity: 0.35, position: "center", scale: 0.05 });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  return (
    <form
      className="max-w-md space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api("/api/admin/settings/watermark", { method: "PUT", body: w });
          setMsg({ tone: "success", text: "Saved. Applies to previews of new deliveries with “Watermark previews” enabled." });
        } catch (err) {
          setMsg({ tone: "error", text: err instanceof ApiError ? err.message : "Save failed" });
        }
      }}
    >
      <Field label="Text" htmlFor="wtext">
        <Input id="wtext" value={w.text} maxLength={80} onChange={(e) => setW({ ...w, text: e.target.value })} />
      </Field>
      <Field label="Position" htmlFor="wpos">
        <Select id="wpos" value={w.position} onChange={(e) => setW({ ...w, position: e.target.value })}>
          <option value="center">Center</option>
          <option value="bottom-right">Bottom right</option>
          <option value="tiled">Tiled</option>
        </Select>
      </Field>
      <Slider label="Opacity" value={Math.round(w.opacity * 100)} min={5} max={90} neutral={35} onChange={(v) => setW({ ...w, opacity: v / 100 })} format={(v) => `${v}%`} />
      <Slider label="Size" value={Math.round(w.scale * 100)} min={2} max={20} neutral={5} onChange={(v) => setW({ ...w, scale: v / 100 })} format={(v) => `${v}%`} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button variant="primary" type="submit">
        Save watermark
      </Button>
    </form>
  );
}
