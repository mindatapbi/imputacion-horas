import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SessionData, sessionOptions } from "@/lib/session";
import { getValidToken } from "@/lib/redis";

export async function GET(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user?.accountId || !session.cloudId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const accessToken = await getValidToken(session.user.accountId, session.cloudId);
  if (!accessToken) return NextResponse.json({ error: "Sesión expirada" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

  try {
    const jql = encodeURIComponent(`worklogAuthor = currentUser() AND worklogDate >= "${startDate}" AND worklogDate <= "${endDate}"`);
    const issuesRes = await fetch(
      `https://api.atlassian.com/ex/jira/${session.cloudId}/rest/api/3/search/jql?jql=${jql}&fields=summary&maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
    );
    const issuesData = await issuesRes.json();
    const issues = issuesData.issues || [];
    const dailyHours: Record<string, number> = {};

    await Promise.all(issues.map(async (issue: any) => {
      const wlRes = await fetch(
        `https://api.atlassian.com/ex/jira/${session.cloudId}/rest/api/3/issue/${issue.key}/worklog`,
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
      );
      const wlData = await wlRes.json();
      for (const wl of wlData.worklogs || []) {
        if (wl.author?.accountId !== session.user?.accountId) continue;
        const started = wl.started?.substring(0, 10);
        if (started >= startDate && started <= endDate) {
          dailyHours[started] = (dailyHours[started] || 0) + wl.timeSpentSeconds / 3600;
        }
      }
    }));
    return NextResponse.json({ dailyHours });
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener calendario" }, { status: 500 });
  }
}