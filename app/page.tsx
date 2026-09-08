import Link from "next/link";
import { OPDS_URL } from "@/lib/site";

export default function Home() {
  return (
    <main>
      <h1>Instapaper → your e-reader</h1>
      <p>
        Your Instapaper account, served as an OPDS catalog. Works with any
        reader that supports OPDS — including CrossPoint firmware on the Xteink
        X3, X4, and X4 Pro.
      </p>
      <h2>Set up your reader (once)</h2>
      <ol>
        <li>
          On CrossPoint: <b>Settings → System → OPDS Servers → Add Server</b>{" "}
          (on other readers, open your OPDS client's server settings)
        </li>
        <li>
          Server URL: <code>{OPDS_URL}</code>
        </li>
        <li>
          Username / password:{" "}
          <Link href="/signup">create an account</Link> (or use the one you made)
        </li>
        <li>
          Open the catalog from your home screen, browse, download. Newest
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
      <h2>Support this project</h2>
      <a href="https://www.buymeacoffee.com/samstern" target="_blank" rel="noopener noreferrer">
        <img
          src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=samstern&button_colour=FFDD00&font_colour=000000&font_family=Poppins&outline_colour=000000&coffee_colour=ffffff"
          alt="Buy me a coffee"
          width={178}
          height={40}
        />
      </a>
    </main>
  );
}
