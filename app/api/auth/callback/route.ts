import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SessionData, sessionOptions } from "@/lib/session";
import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const TOKEN_DIR = path.join(process.cwd(), ".token-store");

async function saveToken(accountId: string, token: string) {
  if (!existsSync(TOKEN_DIR)) await mkdir(TOKEN_DIR, { recursive: true });
  await writeFile(path.join(TOKEN_DIR, `${accountId}.json`), JSON.stringify({ token }), "utf-8");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url));
  }

  try {
    const tokenResponse = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: process.env.ATLASSIAN_CLIENT_ID,
        client_secret: process.env.ATLASSIAN_CLIENT_SECRET,
        code,
        redirect_uri: process.env.ATLASSIAN_CALLBACK_URL,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL("/?error=token_failed", request.url));
    }

    const resourcesResponse = await fetch(
      "https://api.atlassian.com/oauth/token/accessible-resources",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const resources = await resourcesResponse.json();
    const cloudId = resources[0]?.id;

    const userResponse = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const userData = await userResponse.json();

    // Guardar token en disco (server-side), NO en la cookie
    await saveToken(userData.accountId, tokenData.access_token);

    // En la cookie solo guardamos IDs pequeños
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    session.cloudId = cloudId;
    session.user = {
      accountId: userData.accountId,
      displayName: userData.displayName,
      email: userData.emailAddress,
      avatarUrl: userData.avatarUrls?.["48x48"] || "",
    };
    await session.save();

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }
}