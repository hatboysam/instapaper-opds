import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
