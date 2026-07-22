"use client";

import { useEffect, useState } from "react";

interface Project {
  key: string;
  name: string;
  avatarUrl: string;
}

interface Issue {
  key: string;
  summary: string;
  status: string;
  project: string;
  issueType: string;
}

interface Entry {
  issueKey: string;
  summary: string;
  hours: number;
  minutes: number;
  comment: string;
}

const JORNADA_HORAS = 8;
const OBJETIVO_HORAS = 7.2;

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "In Development": { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  "In Progress":    { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  "On Hold":        { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" },
  "To Do":          { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
  "Done":           { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  "Closed":         { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  "Blocked":        { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
};

const ISSUE_TYPE_STYLES: Record<string, { bg: string; text: string; emoji: string }> = {
  "Epic":     { bg: "bg-purple-100", text: "text-purple-700", emoji: "⚡" },
  "Story":    { bg: "bg-green-100",  text: "text-green-700",  emoji: "📗" },
  "Task":     { bg: "bg-blue-100",   text: "text-blue-700",   emoji: "✅" },
  "Sub-task": { bg: "bg-gray-100",   text: "text-gray-600",   emoji: "↳" },
  "Bug":      { bg: "bg-red-100",    text: "text-red-700",    emoji: "🐛" },
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] || { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {status}
    </span>
  );
}

function IssueTypeBadge({ type }: { type: string }) {
  const style = ISSUE_TYPE_STYLES[type] || { bg: "bg-gray-100", text: "text-gray-600", emoji: "📄" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.emoji} {type}
    </span>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<{ displayName: string; email: string; avatarUrl: string } | null>(null);
  const [issueSearch, setIssueSearch] = useState("");

  useEffect(() => {
    fetchUser();
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) fetchIssues(selectedProject);
    else setIssues([]);
    setIssueSearch("");
  }, [selectedProject]);

  const fetchUser = async () => {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
    }
  };

  const fetchProjects = async () => {
    setLoadingProjects(true);
    const res = await fetch("/api/jira/issues");
    if (res.status === 401) { window.location.href = "/"; return; }
    const data = await res.json();
    setProjects(data.projects || []);
    setLoadingProjects(false);
  };

  const fetchIssues = async (projectKey: string) => {
    setLoadingIssues(true);
    const res = await fetch(`/api/jira/issues?project=${projectKey}`);
    const data = await res.json();
    setIssues(data.issues || []);
    setLoadingIssues(false);
  };

  const addEntry = (issue: Issue) => {
    if (entries.find((e) => e.issueKey === issue.key)) return;
    setEntries([...entries, { issueKey: issue.key, summary: issue.summary, hours: 0, minutes: 0, comment: "" }]);
  };

  const updateEntry = (issueKey: string, field: keyof Entry, value: string | number) => {
    setEntries(entries.map((e) => (e.issueKey === issueKey ? { ...e, [field]: value } : e)));
  };

  const removeEntry = (issueKey: string) => {
    setEntries(entries.filter((e) => e.issueKey !== issueKey));
  };

  const totalHoras = entries.reduce((acc, e) => acc + e.hours + e.minutes / 60, 0);
  const porcentaje = Math.min((totalHoras / JORNADA_HORAS) * 100, 100);
  const llegaObjetivo = totalHoras >= OBJETIVO_HORAS;

  const filteredIssues = issues.filter(
    (i) =>
      i.summary.toLowerCase().includes(issueSearch.toLowerCase()) ||
      i.key.toLowerCase().includes(issueSearch.toLowerCase())
  );

  const handleSubmit = async () => {
    if (entries.length === 0) return;
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/jira/worklog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: entries.map((e) => ({ ...e, date })) }),
    });

    const data = await res.json();

    if (data.errors?.length > 0) {
      setError(`No se pudieron imputar: ${data.errors.map((e: any) => e.issueKey).join(", ")}`);
    } else {
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-200">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Horas imputadas!</h2>
          <p className="text-gray-500 mb-2">Registraste <span className="font-semibold text-gray-800">{totalHoras.toFixed(1)}h</span> en Jira.</p>
          <p className="text-sm text-gray-400 mb-8">{new Date(date + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <button
            onClick={() => { setSubmitted(false); setEntries([]); }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors"
          >
            Imputar otro día
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-3 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{width:18,height:18}}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-sm">Imputación de Horas</span>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} className="w-8 h-8 rounded-full ring-2 ring-gray-100" alt={user.displayName} />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  {user.displayName.charAt(0)}
                </div>
              )}
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900 leading-tight">{user.displayName}</p>
                <p className="text-xs text-gray-400 leading-tight">{user.email}</p>
              </div>
              <a href="/api/auth/logout" className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-1 border border-gray-200 rounded-lg px-2.5 py-1.5">
                Salir
              </a>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Fecha + progreso */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Fecha de imputación</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 sm:max-w-sm">
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Progreso del día</span>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${llegaObjetivo ? "text-green-600" : "text-orange-500"}`}>
                    {totalHoras.toFixed(1)}h
                  </span>
                  <span className="text-gray-300 text-sm font-medium"> / {JORNADA_HORAS}h</span>
                </div>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${llegaObjetivo ? "bg-gradient-to-r from-green-400 to-green-500" : "bg-gradient-to-r from-orange-300 to-orange-500"}`}
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <p className="text-xs text-gray-400">Objetivo: {OBJETIVO_HORAS}h (90% de la jornada)</p>
                {llegaObjetivo && <p className="text-xs text-green-600 font-medium">✓ Completado</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Panel izquierdo */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div>
              <h2 className="font-bold text-gray-900 text-base">Buscar tickets</h2>
              <p className="text-xs text-gray-400 mt-0.5">Tickets activos — excluye los finalizados</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Proyecto</label>
              {loadingProjects ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                  <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                  Cargando proyectos...
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white pr-8"
                  >
                    <option value="">— Elegí un proyecto —</option>
                    {projects.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.name} ({p.key})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {selectedProject && (
              <div className="relative">
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Filtrar tickets..."
                  value={issueSearch}
                  onChange={(e) => setIssueSearch(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {loadingIssues ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
                  <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                  Cargando tickets...
                </div>
              ) : !selectedProject ? (
                <div className="text-center py-10">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">Elegí un proyecto para ver sus tickets</p>
                </div>
              ) : filteredIssues.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">No se encontraron tickets activos</div>
              ) : (
                filteredIssues.map((issue) => {
                  const added = entries.some((e) => e.issueKey === issue.key);
                  return (
                    <div
                      key={issue.key}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        added ? "border-blue-200 bg-blue-50" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="min-w-0 flex-1 mr-3">
                        <p className={`text-sm font-medium truncate ${added ? "text-blue-800" : "text-gray-900"}`}>
                          {issue.summary}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-xs font-mono font-semibold text-blue-500">{issue.key}</span>
                          <IssueTypeBadge type={issue.issueType} />
                          <StatusBadge status={issue.status} />
                        </div>
                      </div>
                      <button
                        onClick={() => addEntry(issue)}
                        disabled={added}
                        className={`flex-shrink-0 text-sm font-medium px-3 py-1.5 rounded-lg transition-all ${
                          added
                            ? "text-blue-400 bg-blue-100 cursor-default"
                            : "text-blue-600 hover:bg-blue-50 border border-blue-200 hover:border-blue-300"
                        }`}
                      >
                        {added ? "✓" : "+ Agregar"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Panel derecho */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
            <div className="mb-4">
              <h2 className="font-bold text-gray-900 text-base">Horas del día</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {entries.length === 0 ? "Ningún ticket seleccionado" : `${entries.length} ticket${entries.length > 1 ? "s" : ""} seleccionado${entries.length > 1 ? "s" : ""}`}
              </p>
            </div>

            {entries.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-400">Sin tickets seleccionados</p>
                <p className="text-xs text-gray-300 mt-1">Agregá tickets desde el panel izquierdo</p>
              </div>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {entries.map((entry) => (
                  <div key={entry.issueKey} className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{entry.summary}</p>
                        <span className="text-xs font-mono font-semibold text-blue-500">{entry.issueKey}</span>
                      </div>
                      <button
                        onClick={() => removeEntry(entry.issueKey)}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
                        <input
                          type="number" min={0} max={24}
                          value={entry.hours}
                          onChange={(e) => updateEntry(entry.issueKey, "hours", parseInt(e.target.value) || 0)}
                          className="w-10 text-center text-sm font-semibold text-gray-900 focus:outline-none"
                        />
                        <span className="text-xs text-gray-400">h</span>
                      </div>
                      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
                        <input
                          type="number" min={0} max={59} step={15}
                          value={entry.minutes}
                          onChange={(e) => updateEntry(entry.issueKey, "minutes", parseInt(e.target.value) || 0)}
                          className="w-10 text-center text-sm font-semibold text-gray-900 focus:outline-none"
                        />
                        <span className="text-xs text-gray-400">min</span>
                      </div>
                      <input
                        type="text"
                        placeholder="Comentario (opcional)"
                        value={entry.comment}
                        onChange={(e) => updateEntry(entry.issueKey, "comment", e.target.value)}
                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {entries.length > 0 && (
              <button
                onClick={handleSubmit}
                disabled={submitting || totalHoras === 0}
                className={`mt-4 w-full font-semibold py-3 rounded-xl transition-all text-sm ${
                  totalHoras === 0
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : submitting
                    ? "bg-blue-400 text-white cursor-wait"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                }`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Imputando en Jira...
                  </span>
                ) : (
                  `Imputar ${totalHoras.toFixed(1)}h en Jira →`
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}