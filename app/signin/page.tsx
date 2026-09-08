"use client";

import { useState } from "react";

export default function SignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong");
        setStatus("idle");
        return;
      }
      window.location.href = "/profile";
    } catch {
      setError("Network error — try again");
      setStatus("idle");
    }
  };

  return (
    <main>
      <h1>Sign in</h1>
      <form onSubmit={submit} style={{ display: "grid", gap: "1rem", maxWidth: "24rem" }}>
        <label>
          Username
          <br />
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label>
          Password
          <br />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p style={{ color: "#c0392b" }}>{error}</p>}
        <button disabled={status === "loading"} type="submit">
          {status === "loading" ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p style={{ marginTop: "1.5rem" }}>
        No account yet? <a href="/signup">Sign up</a>
      </p>
    </main>
  );
}
