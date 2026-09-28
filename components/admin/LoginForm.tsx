"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <form
      className="space-y-5 rounded-2xl border border-ink-700 bg-ink-850 p-7"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
          await api("/api/admin/auth/login", { body: { email, password } });
          router.replace("/admin");
          router.refresh();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Sign in failed");
        } finally {
          setLoading(false);
        }
      }}
    >
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
        Sign in
      </Button>
    </form>
  );
}
