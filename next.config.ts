import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["firebase-admin", "epub-gen-memory", "linkedom"],
};

export default config;
