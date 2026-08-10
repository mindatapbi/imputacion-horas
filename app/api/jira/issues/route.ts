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
  const projectKey = searchParams.get("project");
  const query = searchParams.get("q");

  try {
    // ── BÚSQUEDA GLOBAL POR TEXTO ──────────────────────────────────────────
    if (query) {
      const jql = encodeURIComponent(
        `statusCategory != Done AND (summary ~ "${query}" OR key = "${query}") ORDER BY updated DESC`
      );
      const url = `https://api.atlassian.com/ex/jira/${session.cloudId}/rest/api/3/search/jql?jql=${jql}&fields=summary,status,project,issuetype,parent&maxResults=20`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
      const data = await response.json();
      const issues = data.issues?.map((issue: any) => ({
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name,
        project: issue.fields.project?.name,
        projectKey: issue.fields.project?.key,
        issueType: issue.fields.issuetype?.name || "Task",
        parentKey: issue.fields.parent?.key || null,
        parentSummary: issue.fields.parent?.fields?.summary || null,
      })) || [];
      return NextResponse.json({ issues });
    }

    // ── LISTAR PROYECTOS ───────────────────────────────────────────────────
    if (!projectKey) {
      const response = await fetch(
        `https://api.atlassian.com/ex/jira/${session.cloudId}/rest/api/3/project/search?maxResults=100&orderBy=name&action=browse`,
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
      );
      const data = await response.json();
      const projects = data.values?.map((p: any) => ({ key: p.key, name: p.name })) || [];
      return NextResponse.json({ projects });
    }

    // ── TICKETS POR PROYECTO ───────────────────────────────────────────────
    const includeDone = searchParams.get("includeDone") === "true";
    const jql = encodeURIComponent(`project = "${projectKey}"${!includeDone ? ' AND statusCategory != Done' : ''} ORDER BY issuetype ASC, updated DESC`);
    const url = `https://api.atlassian.com/ex/jira/${session.cloudId}/rest/api/3/search/jql?jql=${jql}&fields=summary,status,project,issuetype,parent,assignee&maxResults=100`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
    const data = await response.json();
    const issues = data.issues?.map((issue: any) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name,
      project: issue.fields.project?.name,
      projectKey: issue.fields.project?.key,
      assigneeId: issue.fields.assignee?.accountId || null,
      issueType: issue.fields.issuetype?.name || "Task",
      parentKey: issue.fields.parent?.key || null,
      parentSummary: issue.fields.parent?.fields?.summary || null,
    })) || [];
    return NextResponse.json({ issues });

  } catch (error) {
    return NextResponse.json({ error: "Error al obtener datos" }, { status: 500 });
  }
}