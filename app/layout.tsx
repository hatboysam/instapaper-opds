import type { Metadata } from "next";
import Link from "next/link";
import { GITHUB_ISSUES_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: "Instapaper → OPDS",
  description:
    "OPDS catalog for reading Instapaper articles on any OPDS-compatible e-reader (CrossPoint firmware on Xteink X3/X4/X4 Pro and others)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer>
          <p>
            <Link href="/signup">Sign up</Link> · <Link href="/signin">Sign in</Link> ·{" "}
            <Link href="/profile">Manage account</Link> ·{" "}
            <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer">
              Feedback
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
