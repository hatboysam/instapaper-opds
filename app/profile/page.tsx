import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, parseSessionToken } from "@/server/session";
import ProfileClient from "./profile-client";

export const dynamic = "force-dynamic";

export default async function Profile() {
  const store = await cookies();
  const username = parseSessionToken(store.get(SESSION_COOKIE)?.value)?.username;
  if (!username) redirect("/signin");
  return <ProfileClient username={username} />;
}
