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
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "Faltan fechas" }, { status: 400 });

  try {
    const jql = encodeURIComponent(`worklogAuthor = currentUser() AND worklogDate >= "${from}" AND worklogDate <= "${to}"`);
    const issuesRes = await fetch(
      `https://api.atlassian.com/ex/jira/${session.cloudId}/rest/api/3/search/jql?jql=${jql}&fields=summary,project,issuetype,parent&maxResults=100`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
    );
    const issuesData = await issuesRes.json();
    const issues = issuesData.issues || [];
    const entries: any[] = [];

    await Promise.all(issues.map(async (issue: any) => {
      const wlRes = await fetch(
        `https://api.atlassian.com/ex/jira/${session.cloudId}/rest/api/3/issue/${issue.key}/worklog`,
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
      );
      const wlData = await wlRes.json();
      for (const wl of wlData.worklogs || []) {
        if (wl.author?.accountId !== session.user?.accountId) continue;
        const date = wl.started?.substring(0, 10);
        if (date < from || date > to) continue;
        const comment = wl.comment?.content?.[0]?.content?.[0]?.text || "";
        entries.push({
          worklogId: wl.id,
          issueKey: issue.key,
          issueSummary: issue.fields.summary,
          issueType: issue.fields.issuetype?.name || "Task",
          project: issue.fields.project?.name,
          projectKey: issue.fields.project?.key,
          parentKey: issue.fields.parent?.key || null,
          parentSummary: issue.fields.parent?.fields?.summary || null,
          date,
          hours: Math.floor(wl.timeSpentSeconds / 3600),
          minutes: Math.floor((wl.timeSpentSeconds % 3600) / 60),
          timeSpentSeconds: wl.timeSpentSeconds,
          comment,
        });
      }
    }));

    entries.sort((a, b) => (a.parentKey || "").localeCompare(b.parentKey || "") || a.issueKey.localeCompare(b.issueKey) || a.date.localeCompare(b.date));
    return NextResponse.json({ entries });
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener timesheet" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user?.accountId || !session.cloudId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const accessToken = await getValidToken(session.user.accountId, session.cloudId);
  if (!accessToken) return NextResponse.json({ error: "Sesión expirada" }, { status: 401 });

  const { issueKey, worklogId, hours, minutes, comment, date } = await request.json();
  const timeSpentSeconds = hours * 3600 + minutes * 60;
  if (timeSpentSeconds === 0) return NextResponse.json({ error: "El tiempo no puede ser 0" }, { status: 400 });

  try {
    const res = await fetch(
      `https://api.atlassian.com/ex/jira/${session.cloudId}/rest/api/3/issue/${issueKey}/worklog/${worklogId}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          timeSpentSeconds, started: `${date}T09:00:00.000+0000`,
          comment: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: comment || "Imputación de horas" }] }] },
        }),
      }
    );
    if (res.ok) return NextResponse.json({ ok: true });
    const err = await res.json();
    return NextResponse.json({ error: err }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.user?.accountId || !session.cloudId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const accessToken = await getValidToken(session.user.accountId, session.cloudId);
  if (!accessToken) return NextResponse.json({ error: "Sesión expirada" }, { status: 401 });

  const { issueKey, worklogId } = await request.json();
  try {
    const res = await fetch(
      `https://api.atlassian.com/ex/jira/${session.cloudId}/rest/api/3/issue/${issueKey}/worklog/${worklogId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.ok || res.status === 204) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: "No se pudo eliminar" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}