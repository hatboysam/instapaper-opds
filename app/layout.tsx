import type { Metadata } from "next";
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
          <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer">
            Feedback — report an issue on GitHub
          </a>
        </footer>
      </body>
    </html>
  );
}
