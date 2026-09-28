"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input, Modal, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";

export function NewProjectButton({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", clientId: "", shootDate: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        New project
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New project">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            try {
              const { project } = await api<{ project: { id: string } }>("/api/admin/projects", {
                body: { name: form.name, clientId: form.clientId || null, shootDate: form.shootDate || null, description: form.description || null },
              });
              router.push(`/admin/projects/${project.id}`);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Could not create project");
            } finally {
              setLoading(false);
            }
          }}
        >
          <Field label="Project name" htmlFor="pname">
            <Input id="pname" required maxLength={160} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Surf Session" />
          </Field>
          <Field label="Client" htmlFor="pclient">
            <Select id="pclient" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">— none yet —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Shoot date" htmlFor="pdate">
            <Input id="pdate" type="date" value={form.shootDate} onChange={(e) => setForm({ ...form, shootDate: e.target.value })} />
          </Field>
          <Field label="Notes" htmlFor="pdesc">
            <Input id="pdesc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              Create project
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function NewClientButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        New client
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New client">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            try {
              await api("/api/admin/clients", { body: { name: form.name, email: form.email || null, phone: form.phone || null, notes: form.notes || null } });
              setOpen(false);
              setForm({ name: "", email: "", phone: "", notes: "" });
              router.refresh();
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Could not create client");
            } finally {
              setLoading(false);
            }
          }}
        >
          <Field label="Name" htmlFor="cname">
            <Input id="cname" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email" htmlFor="cemail">
            <Input id="cemail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone" htmlFor="cphone">
            <Input id="cphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Notes" htmlFor="cnotes">
            <Input id="cnotes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              Add client
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
