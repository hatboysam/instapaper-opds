import crypto from "node:crypto";
import { signValue } from "./session";

export interface BookParams {
  id: number;
  title: string;
  url?: string;
  timestamp: number;
}

export function bookParamsSignature(params: {
  id: number;
  title: string;
  url: string;
  timestamp: string;
}): string {
  return signValue(`book-href|${params.id}|${params.title}|${params.url}|${params.timestamp}`);
}

export function verifyBookParams(
  params: { id: number; title: string; url: string; timestamp: string },
  signature: string | null,
): boolean {
  if (!signature) return false;
  const expected = bookParamsSignature(params);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
