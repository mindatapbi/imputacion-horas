import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

export async function saveToken(accountId: string, token: string) {
  await redis.set(`token:${accountId}`, token, { ex: 60 * 60 * 8 }); // expira en 8hs
}

export async function getToken(accountId: string): Promise<string | null> {
  return await redis.get(`token:${accountId}`);
}