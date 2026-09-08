"use client";

import { useEffect, useState } from "react";

interface Profile {
  username: string;
  instapaperUsername?: string;
  createdAt?: string;
  opdsUrl: string;
}

const field = { display: "grid", gap: "1rem", maxWidth: "24rem" } as const;

export default function ProfileClient({ username }: { username: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [ipUser, setIpUser] = useState("");
  const [ipPass, setIpPass] = useState("");
  const [ipMsg, setIpMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => {
        const data = (await res.json()) as Profile & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load profile");
        setProfile(data);
        setIpUser(data.instapaperUsername ?? "");
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (res.ok && data.ok) {
      setPwMsg({ ok: true, text: "Password updated. Update your X4's OPDS server entry too." });
      setPwCurrent("");
      setPwNew("");
    } else {
      setPwMsg({ ok: false, text: data.error ?? "Something went wrong" });
    }
  };

  const updateInstapaper = async (e: React.FormEvent) => {
    e.preventDefault();
    setIpMsg(null);
    const res = await fetch("/api/profile/instapaper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instapaperUsername: ipUser, instapaperPassword: ipPass }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (res.ok && data.ok) {
      setIpMsg({ ok: true, text: "Instapaper credentials updated" });
      setIpPass("");
      setProfile((p) => (p ? { ...p, instapaperUsername: ipUser } : p));
    } else {
      setIpMsg({ ok: false, text: data.error ?? "Something went wrong" });
    }
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/signin";
  };

  if (error) {
    return (
      <main>
        <h1>Account</h1>
        <p style={{ color: "#c0392b" }}>{error}</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Account: {username}</h1>
      {profile && (
        <>
          <h2>Device setup</h2>
          <ul>
            <li>
              OPDS URL: <code>{profile.opdsUrl}</code>
            </li>
            <li>
              Username: <code>{profile.username}</code>
            </li>
            <li>Password: your app password (change it below; update the X4 after)</li>
          </ul>
          <p>
            Instapaper account: <code>{profile.instapaperUsername ?? "unknown"}</code>
            {profile.createdAt ? ` (member since ${profile.createdAt.slice(0, 10)})` : ""}
          </p>
        </>
      )}

      <h2>Change app password</h2>
      <form onSubmit={changePassword} style={field}>
        <label>
          Current password
          <br />
          <input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} autoComplete="current-password" />
        </label>
        <label>
          New password (8+ chars)
          <br />
          <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} autoComplete="new-password" />
        </label>
        {pwMsg && <p style={{ color: pwMsg.ok ? "#1e7d43" : "#c0392b" }}>{pwMsg.text}</p>}
        <button type="submit">Change password</button>
      </form>

      <h2>Instapaper credentials</h2>
      <p>
        If your Instapaper password changed or downloads started failing with auth errors,
        update your Instapaper email and password here. They are used once to get a fresh
        API token and are not stored.
      </p>
      <form onSubmit={updateInstapaper} style={field}>
        <label>
          Instapaper email
          <br />
          <input value={ipUser} onChange={(e) => setIpUser(e.target.value)} autoComplete="off" />
        </label>
        <label>
          Instapaper password
          <br />
          <input type="password" value={ipPass} onChange={(e) => setIpPass(e.target.value)} autoComplete="off" />
        </label>
        {ipMsg && <p style={{ color: ipMsg.ok ? "#1e7d43" : "#c0392b" }}>{ipMsg.text}</p>}
        <button type="submit">Update Instapaper credentials</button>
      </form>

      <p style={{ marginTop: "2rem" }}>
        <button onClick={logout} type="button">
          Sign out
        </button>
      </p>
    </main>
  );
}
