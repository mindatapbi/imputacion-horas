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
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Horas imputadas!</h2>
          <p className="text-gray-500 mb-6">Tus {totalHoras.toFixed(1)}h quedaron registradas en Jira.</p>
          <button
            onClick={() => { setSubmitted(false); setEntries([]); }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Imputar otro día
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900">Imputación de Horas</span>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              {user.avatarUrl && <img src={user.avatarUrl} className="w-8 h-8 rounded-full" alt={user.displayName} />}
              <span className="text-sm text-gray-600 hidden sm:block">{user.displayName}</span>
              <a href="/api/auth/logout" className="text-sm text-gray-400 hover:text-red-500 transition-colors">Salir</a>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Fecha + progreso */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-1">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 sm:max-w-xs">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Horas cargadas</span>
                <span className={`font-semibold ${llegaObjetivo ? "text-green-600" : "text-orange-500"}`}>
                  {totalHoras.toFixed(1)}h / {JORNADA_HORAS}h
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${llegaObjetivo ? "bg-green-500" : "bg-orange-400"}`}
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Objetivo: {OBJETIVO_HORAS}h (90% de la jornada)</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Panel izquierdo: selector de proyecto y tickets */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Buscar tickets</h2>

            {/* Selector de proyecto */}
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-1">Proyecto</label>
              {loadingProjects ? (
                <div className="text-sm text-gray-400">Cargando proyectos...</div>
              ) : (
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Elegí un proyecto —</option>
                  {projects.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Buscador dentro del proyecto */}
            {selectedProject && (
              <div>
                <input
                  type="text"
                  placeholder="Filtrar tickets..."
                  value={issueSearch}
                  onChange={(e) => setIssueSearch(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Lista de tickets */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {loadingIssues ? (
                <div className="text-center py-6 text-gray-400 text-sm">Cargando tickets...</div>
              ) : !selectedProject ? (
                <div className="text-center py-6 text-gray-400 text-sm">Elegí un proyecto para ver sus tickets</div>
              ) : filteredIssues.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">No se encontraron tickets</div>
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
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{issue.summary}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-blue-600">{issue.key}</span>
                          <span className="text-xs text-gray-400">· {issue.status}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => addEntry(issue)}
                        disabled={added}
                        className={`ml-3 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                          added ? "text-blue-400 bg-blue-100 cursor-default" : "text-blue-600 hover:bg-blue-50"
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

          {/* Panel derecho: horas del día */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Horas del día</h2>

            {entries.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                Agregá tickets desde el panel izquierdo
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => (
                  <div key={entry.issueKey} className="p-4 bg-gray-50 rounded-xl space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{entry.summary}</p>
                        <p className="text-xs text-blue-600">{entry.issueKey}</p>
                      </div>
                      <button
                        onClick={() => removeEntry(entry.issueKey)}
                        className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min={0} max={24}
                          value={entry.hours}
                          onChange={(e) => updateEntry(entry.issueKey, "hours", parseInt(e.target.value) || 0)}
                          className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-400">h</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min={0} max={59} step={15}
                          value={entry.minutes}
                          onChange={(e) => updateEntry(entry.issueKey, "minutes", parseInt(e.target.value) || 0)}
                          className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-400">min</span>
                      </div>
                      <input
                        type="text"
                        placeholder="Comentario"
                        value={entry.comment}
                        onChange={(e) => updateEntry(entry.issueKey, "comment", e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

            {entries.length > 0 && (
              <button
                onClick={handleSubmit}
                disabled={submitting || totalHoras === 0}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {submitting ? "Imputando..." : `Imputar ${totalHoras.toFixed(1)}h en Jira`}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}