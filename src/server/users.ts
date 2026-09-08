import crypto from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

export interface UserRecord {
  username: string;
  passwordHash: string;
  token: string;
  tokenSecret: string;
  instapaperUsername?: string;
  instapaperUserId?: number;
  getTextBlocked: boolean;
  sessionVersion: number;
  createdAt: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function db() {
  if (!getApps().length) {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ??
      process.env.GCLOUD_PROJECT ??
      process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      throw new ConfigError(
        "FIREBASE_PROJECT_ID is not set. Set it in .env.local (dev) or apphosting.yaml (prod).",
      );
    }
    initializeApp({ projectId });
  }
  return getFirestore();
}

function encryptionKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new ConfigError(
      "TOKEN_ENCRYPTION_KEY must be a 64-char hex string (openssl rand -hex 32).",
    );
  }
  return Buffer.from(hex, "hex");
}

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ct.toString("base64"),
  ].join(".");
}

function decrypt(blob: string): string {
  const [version, ivB64, tagB64, ctB64] = blob.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !ctB64) {
    throw new Error("Malformed encrypted value");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export { hashPassword, verifyPassword };

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/;

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username);
}

function toRecord(username: string, doc: Record<string, unknown>): UserRecord {
  return {
    username,
    passwordHash: doc.passwordHash as string,
    token: decrypt(doc.tokenEnc as string),
    tokenSecret: decrypt(doc.tokenSecretEnc as string),
    instapaperUsername: doc.instapaperUsername as string | undefined,
    instapaperUserId:
      typeof doc.instapaperUserId === "number" ? doc.instapaperUserId : undefined,
    getTextBlocked: doc.getTextBlocked === true,
    sessionVersion: typeof doc.sessionVersion === "number" ? doc.sessionVersion : 0,
    createdAt: doc.createdAt as string,
  };
}

export async function getUser(username: string): Promise<UserRecord | null> {
  const snap = await db().collection("users").doc(username).get();
  if (!snap.exists) return null;
  return toRecord(username, snap.data() ?? {});
}

export async function findUsernameByInstapaperUserId(
  userId: number,
): Promise<string | null> {
  const snap = await db()
    .collection("users")
    .where("instapaperUserId", "==", userId)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

export async function createUser(input: {
  username: string;
  password: string;
  token: string;
  tokenSecret: string;
  instapaperUsername: string;
  instapaperUserId?: number;
}): Promise<void> {
  await db()
    .collection("users")
    .doc(input.username)
    .create({
      passwordHash: hashPassword(input.password),
      tokenEnc: encrypt(input.token),
      tokenSecretEnc: encrypt(input.tokenSecret),
      instapaperUsername: input.instapaperUsername,
      instapaperUserId: input.instapaperUserId ?? null,
      getTextBlocked: false,
      sessionVersion: 0,
      createdAt: new Date().toISOString(),
    });
}

export async function updatePasswordHash(
  username: string,
  passwordHash: string,
): Promise<void> {
  await db()
    .collection("users")
    .doc(username)
    .update({
      passwordHash,
      sessionVersion: FieldValue.increment(1),
    });
}

export async function updateInstapaperCredentials(
  username: string,
  creds: {
    token: string;
    tokenSecret: string;
    instapaperUsername: string;
    instapaperUserId?: number;
  },
): Promise<void> {
  await db()
    .collection("users")
    .doc(username)
    .update({
      tokenEnc: encrypt(creds.token),
      tokenSecretEnc: encrypt(creds.tokenSecret),
      instapaperUsername: creds.instapaperUsername,
      ...(creds.instapaperUserId !== undefined
        ? { instapaperUserId: creds.instapaperUserId }
        : {}),
    });
}

export async function setTextBlocked(username: string): Promise<void> {
  await db().collection("users").doc(username).update({ getTextBlocked: true });
}
