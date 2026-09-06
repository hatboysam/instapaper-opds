import { headers } from "next/headers";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const host = (await headers()).get("host") ?? "localhost:3000";
  const baseUrl = `https://${host}`;
  return (
    <main>
      <h1>Instapaper → Xteink X4</h1>
      <p>
        Your Instapaper account, served as an OPDS catalog. Point your X4 at it
        and download articles straight to the reader.
      </p>
      <h2>Set up your X4 (once)</h2>
      <ol>
        <li>
          On the device: <b>Settings → System → OPDS Servers → Add Server</b>
        </li>
        <li>
          Server URL: <code>{baseUrl}/opds</code>
        </li>
        <li>
          Username / password:{" "}
          <Link href="/signup">create an account</Link> (or use the one you made)
        </li>
        <li>
          Open the catalog from the home screen, browse, download. Newest
          articles are first.
        </li>
      </ol>
      <h2>Routes</h2>
      <ul>
        <li>
          Root catalog: <code>{baseUrl}/opds</code>
        </li>
        <li>
          Folders: <code>/opds/unread</code>, <code>/opds/starred</code>,{" "}
          <code>/opds/archive</code>
        </li>
      </ul>
      <p>
        <Link href="/signup">Sign up →</Link>
      </p>
    </main>
  );
}
