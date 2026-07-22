import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SessionData, sessionOptions } from "@/lib/session";
import { readFile } from "fs/promises";
import path from "path";

async function getToken(accountId: string): Promise<string | null> {
  try {
    const data = await readFile(path.join(process.cwd(), ".token-store", `${accountId}.json`), "utf-8");
    return JSON.parse(data).token;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (!session.user?.accountId || !session.cloudId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const accessToken = await getToken(session.user.accountId);
  if (!accessToken) {
    return NextResponse.json({ error: "Token no encontrado" }, { status: 401 });
  }

  const { entries } = await request.json();
  const results = [];
  const errors = [];

  for (const entry of entries) {
    const timeSpentSeconds = (entry.hours * 3600) + (entry.minutes * 60);
    if (timeSpentSeconds === 0) continue;

    try {
      const response = await fetch(
        `https://api.atlassian.com/ex/jira/${session.cloudId}/rest/api/3/issue/${entry.issueKey}/worklog`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            timeSpentSeconds,
            started: `${entry.date}T09:00:00.000+0000`,
            comment: {
              type: "doc",
              version: 1,
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: entry.comment || "Imputación de horas" }],
                },
              ],
            },
          }),
        }
      );

      if (response.ok) {
        results.push({ issueKey: entry.issueKey, ok: true });
      } else {
        const err = await response.json();
        errors.push({ issueKey: entry.issueKey, error: err });
      }
    } catch (error) {
      errors.push({ issueKey: entry.issueKey, error: String(error) });
    }
  }

  return NextResponse.json({ results, errors });
}