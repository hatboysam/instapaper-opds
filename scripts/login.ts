import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { exchangeXAuthToken } from "../src/server/instapaper";
import { createUser, isValidUsername } from "../src/server/users";

function mask(s: string): string {
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  let instapaperUsername = process.env.INSTAPAPER_USERNAME?.trim();
  let instapaperPassword = process.env.INSTAPAPER_PASSWORD;
  if (!instapaperUsername) instapaperUsername = (await rl.question("Instapaper email: ")).trim();
  if (!instapaperPassword) instapaperPassword = await rl.question("Instapaper password: ");

  console.log("Exchanging credentials with Instapaper (xAuth)…");
  const { token, tokenSecret } = await exchangeXAuthToken(
    instapaperUsername,
    instapaperPassword,
  );
  console.log(`xAuth OK\n  token: ${mask(token)}\n  secret: ${mask(tokenSecret)}`);

  const store = (
    await rl.question("Store this account to Firestore now? [Y/n] ")
  )
    .trim()
    .toLowerCase();
  if (store === "n") {
    console.log("\nToken pair for manual use:");
    console.log(`  oauth_token=${token}`);
    console.log(`  oauth_token_secret=${tokenSecret}`);
    rl.close();
    return;
  }

  const suggested = instapaperUsername.split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
  const appUsername = (
    await rl.question(`App username (3-32 chars, a-z0-9_-) [${suggested}]: `)
  )
    .trim()
    .toLowerCase() || suggested;
  if (!isValidUsername(appUsername)) {
    throw new Error(`Invalid app username: ${appUsername}`);
  }
  const appPassword = await rl.question("App password (8+ chars, used by the X4): ");
  if (appPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  try {
    await createUser({
      username: appUsername,
      password: appPassword,
      token,
      tokenSecret,
      instapaperUsername,
    });
    console.log(
      `\nStored user "${appUsername}". Test locally with:\n  npm run dev\n  curl -u ${appUsername}:<password> http://localhost:3000/opds`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/credential|PERMISSION_DENIED|ADC|Could not load/i.test(msg)) {
      console.error(
        `\nCould not reach Firestore (${msg}).\nRun: gcloud auth application-default login\nand make sure a Firestore database exists for project instapaper-opds.`,
      );
    } else {
      throw err;
    }
  }
  rl.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
