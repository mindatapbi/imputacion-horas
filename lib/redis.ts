import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

export async function saveToken(accountId: string, accessToken: string, refreshToken: string) {
  await redis.set(`token:${accountId}`, accessToken, { ex: 60 * 60 * 24 * 30 });
  await redis.set(`refresh:${accountId}`, refreshToken, { ex: 60 * 60 * 24 * 60 });
}

export async function getToken(accountId: string): Promise<string | null> {
  return await redis.get(`token:${accountId}`);
}

export async function getRefreshToken(accountId: string): Promise<string | null> {
  return await redis.get(`refresh:${accountId}`);
}

export async function refreshAccessToken(accountId: string, cloudId: string): Promise<string | null> {
  const refreshToken = await getRefreshToken(accountId);
  if (!refreshToken) return null;

  try {
    const res = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: process.env.ATLASSIAN_CLIENT_ID,
        client_secret: process.env.ATLASSIAN_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.access_token) return null;

    // Guardar nuevo token
    await saveToken(accountId, data.access_token, data.refresh_token || refreshToken);
    return data.access_token;
  } catch {
    return null;
  }
}