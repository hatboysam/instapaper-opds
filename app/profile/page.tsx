import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/server/session";
import ProfileClient from "./profile-client";

export const dynamic = "force-dynamic";

export default async function Profile() {
  const store = await cookies();
  const username = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!username) redirect("/signin");
  return <ProfileClient username={username} />;
}
