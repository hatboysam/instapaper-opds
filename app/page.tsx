import Link from "next/link";
import { OPDS_URL, SITE_URL } from "@/lib/site";

export default function Home() {
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
          Server URL: <code>{OPDS_URL}</code>
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
          Root catalog: <code>{OPDS_URL}</code>
        </li>
        <li>
          Folders: <code>{OPDS_URL}/unread</code>, <code>{OPDS_URL}/starred</code>,{" "}
          <code>{OPDS_URL}/archive</code>
        </li>
      </ul>
      <p>
        <Link href="/signup">Sign up →</Link> · <Link href="/signin">Sign in →</Link> ·{" "}
        <Link href="/profile">Manage account →</Link>
      </p>
      <p style={{ color: "rgba(127,127,127,0.8)" }}>{SITE_URL}</p>
      <h2>Support this project</h2>
      <script
        type="text/javascript"
        src="https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js"
        data-name="bmc-button"
        data-slug="samstern"
        data-color="#FFDD00"
        data-emoji=""
        data-font="Poppins"
        data-text="Buy me a coffee"
        data-outline-color="#000000"
        data-font-color="#000000"
        data-coffee-color="#ffffff"
      ></script>
    </main>
  );
}
