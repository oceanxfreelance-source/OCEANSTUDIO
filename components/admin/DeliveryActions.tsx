"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, CopyButton, Modal } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";

export function DeliveryActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [renewed, setRenewed] = useState<{ link: string; password: string; deliveryId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const live = status === "ACTIVE" || status === "PREPARING" || status === "EXPIRING SOON";
  const secrets = () => api<{ link: string; password: string }>(`/api/admin/deliveries/${id}/secrets`);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {live && (
        <>
          <CopyButton size="md" label="Copy link" getValue={async () => (await secrets()).link} />
          <CopyButton size="md" label="Copy password" getValue={async () => (await secrets()).password} />
          <Button onClick={async () => window.open((await secrets()).link, "_blank", "noopener,noreferrer")}>View delivery</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Revoke
          </Button>
        </>
      )}
      <Button
        variant="primary"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            setRenewed(await api(`/api/admin/deliveries/${id}/renew`, { method: "POST", body: {} }));
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not create delivery");
          } finally {
            setBusy(false);
          }
        }}
      >
        Create new 48-hour delivery
      </Button>
      {error && <Alert tone="error">{error}</Alert>}

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Revoke delivery?">
        <p className="text-sm text-mist-300">The client loses access immediately and the temporary delivery copies are deleted. Your masters and versions are not affected.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              await api(`/api/admin/deliveries/${id}/revoke`, { method: "POST", body: {} });
              setConfirm(false);
              router.refresh();
            }}
          >
            Revoke access
          </Button>
        </div>
      </Modal>

      <Modal open={Boolean(renewed)} onClose={() => setRenewed(null)} title="New 48-hour delivery created">
        {renewed && (
          <div className="space-y-4">
            <p className="text-sm text-mist-300">Built from the same permanent masters and versions — nothing was re-uploaded.</p>
            <div className="space-y-2 rounded-lg bg-ink-900 p-4 font-mono text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{renewed.link}</span>
                <CopyButton label="Copy link" getValue={() => renewed.link} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>{renewed.password}</span>
                <CopyButton label="Copy password" getValue={() => renewed.password} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => router.push(`/admin/deliveries/${renewed.deliveryId}`)}>
                Open delivery
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
