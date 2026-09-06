import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Instapaper → Xteink X4",
  description: "OPDS catalog for reading Instapaper articles on an Xteink X4",
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
