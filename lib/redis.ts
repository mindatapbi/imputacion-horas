// Almacenamiento de tokens OAuth de Atlassian.
// Principal: Firestore (GCP). Respaldo: Upstash Redis (solo durante la transición).
// - Si Firestore falla (permisos, red), la app sigue funcionando con Upstash.
// - Si un usuario aún no tiene token en Firestore, se lee de Upstash y se copia,
//   así nadie necesita volver a loguearse.
// Cuando todo esté estable, se puede quitar la parte de Upstash.
import { Firestore, Timestamp } from "@google-cloud/firestore";
import { Redis } from "@upstash/redis";

const ACCESS_TTL_MS = 55 * 60 * 1000;            // 55 min — expira antes que Atlassian
const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 días

const tokens = new Firestore().collection("tokens");

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN ? Redis.fromEnv() : null;

type TokenDoc = {
  accessToken?: string;
  accessExpiresAt?: number;
  refreshToken?: string;
  expiresAt?: Timestamp;
};

async function readDoc(accountId: string): Promise<TokenDoc | null> {
  try {
    const snap = await tokens.doc(accountId).get();
    return (snap.data() as TokenDoc) ?? null;
  } catch (e) {
    console.error("[tokens] Firestore read failed, usando Upstash:", e);
    return null;
  }
}

export async function saveToken(accountId: string, accessToken: string, refreshToken: string) {
  const now = Date.now();
  let saved = false;
  try {
    await tokens.doc(accountId).set({
      accessToken,
      accessExpiresAt: now + ACCESS_TTL_MS,
      refreshToken,
      expiresAt: Timestamp.fromMillis(now + REFRESH_TTL_MS), // campo de la política TTL
    });
    saved = true;
  } catch (e) {
    console.error("[tokens] Firestore write failed:", e);
  }
  // Mientras dure la transición también se guarda en Upstash (respaldo)
  if (redis) {
    try {
      await redis.set(`token:${accountId}`, accessToken, { ex: 60 * 55 });
      await redis.set(`refresh:${accountId}`, refreshToken, { ex: 60 * 60 * 24 * 60 });
      saved = true;
    } catch (e) {
      console.error("[tokens] Upstash write failed:", e);
    }
  }
  if (!saved) throw new Error("No se pudo guardar el token");
}

export async function getToken(accountId: string): Promise<string | null> {
  const d = await readDoc(accountId);
  if (d?.accessToken && (d.accessExpiresAt ?? 0) > Date.now()) return d.accessToken;
  if (redis) {
    try {
      return await redis.get<string>(`token:${accountId}`);
    } catch {
      return null;
    }
  }
  return null;
}

export async function getRefreshToken(accountId: string): Promise<string | null> {
  const d = await readDoc(accountId);
  if (d?.refreshToken && d.expiresAt && d.expiresAt.toMillis() > Date.now()) return d.refreshToken;
  if (redis) {
    try {
      return await redis.get<string>(`refresh:${accountId}`);
    } catch {
      return null;
    }
  }
  return null;
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
    await saveToken(accountId, data.access_token, data.refresh_token || refreshToken);
    return data.access_token;
  } catch {
    return null;
  }
}

// Función centralizada — usa en todas las rutas de Jira
export async function getValidToken(accountId: string, cloudId: string): Promise<string | null> {
  const token = await getToken(accountId);
  if (token) return token;
  // Token expiró — renovar automáticamente con refresh token
  return await refreshAccessToken(accountId, cloudId);
}
