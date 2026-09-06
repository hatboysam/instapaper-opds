"use client";

import { useState } from "react";

export default function Signup() {
  const [form, setForm] = useState({
    username: "",
    password: "",
    instapaperUsername: "",
    instapaperPassword: "",
    inviteCode: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong");
        setStatus("idle");
        return;
      }
      setStatus("done");
    } catch {
      setError("Network error — try again");
      setStatus("idle");
    }
  };

  if (status === "done") {
    return (
      <main>
        <h1>Account created</h1>
        <p>
          On your X4: <b>Settings → System → OPDS Servers → Add Server</b>
        </p>
        <ul>
          <li>
            URL: <code>/opds</code> (same address as this site)
          </li>
          <li>
            Username: <code>{form.username}</code>
          </li>
          <li>Password: the one you just chose</li>
        </ul>
        <p>Then open the catalog from the device home screen.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Create account</h1>
      <p>
        Your Instapaper credentials are used once to get an API token and are
        not stored.
      </p>
      <form onSubmit={submit} style={{ display: "grid", gap: "1rem", maxWidth: "24rem" }}>
        <label>
          Username
          <br />
          <input value={form.username} onChange={set("username")} autoComplete="username" />
        </label>
        <label>
          Password (8+ chars)
          <br />
          <input type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
        </label>
        <label>
          Invite code (if asked for one)
          <br />
          <input value={form.inviteCode} onChange={set("inviteCode")} autoComplete="off" />
        </label>
        <label>
          Instapaper email
          <br />
          <input value={form.instapaperUsername} onChange={set("instapaperUsername")} autoComplete="off" />
        </label>
        <label>
          Instapaper password
          <br />
          <input type="password" value={form.instapaperPassword} onChange={set("instapaperPassword")} autoComplete="off" />
        </label>
        {error && <p style={{ color: "#c0392b" }}>{error}</p>}
        <button disabled={status === "loading"} type="submit">
          {status === "loading" ? "Creating…" : "Create account"}
        </button>
      </form>
    </main>
  );
}
