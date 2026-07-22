"use client";

import { useEffect, useState, useRef } from "react";

interface Project { key: string; name: string; }
interface Issue {
  key: string; summary: string; status: string;
  project: string; issueType: string;
  parentKey: string | null; parentSummary: string | null;
}
interface Entry { issueKey: string; summary: string; hours: number; minutes: number; comment: string; }
interface Group { parentKey: string | null; parentSummary: string | null; issues: Issue[]; }

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
  const c = STATUS_COLORS[status] || { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}><span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{status}</span>;
}
function IssueTypeBadge({ type }: { type: string }) {
  const s = ISSUE_TYPE_STYLES[type] || { bg: "bg-gray-100", text: "text-gray-600", emoji: "📄" };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>{s.emoji} {type}</span>;
}

function ProjectSelector({ projects, value, onChange }: { projects: Project[]; value: string; onChange: (k: string) => void }) {
  const [search, setSearch] = useState(""); const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  const selected = projects.find(p => p.key === value);
  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.key.toLowerCase().includes(search.toLowerCase()));
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
        {selected ? <span className="text-gray-900">{selected.name} <span className="text-blue-500 font-mono font-semibold">({selected.key})</span></span> : <span className="text-gray-400">— Elegí un proyecto —</span>}
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input autoFocus type="text" placeholder="Buscar proyecto..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">Sin resultados</p> : filtered.map(p => (
              <button key={p.key} onClick={() => { onChange(p.key); setOpen(false); setSearch(""); }} className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between ${value === p.key ? "bg-blue-50" : ""}`}>
                <span className="text-gray-900 truncate">{p.name}</span>
                <span className="text-blue-500 font-mono text-xs font-semibold ml-2 flex-shrink-0">{p.key}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EpicGroup({ group, entries, onAdd }: { group: Group; entries: Entry[]; onAdd: (issue: Issue) => void }) {
  const [collapsed, setCollapsed] = useState(true); // colapsado por defecto
  const isEpic = !!group.parentKey;
  const addedCount = group.issues.filter(i => entries.some(e => e.issueKey === i.key)).length;
  return (
    <div className="mb-2">
      <button onClick={() => setCollapsed(!collapsed)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left ${isEpic ? "hover:bg-purple-50" : "hover:bg-gray-50"}`}>
        <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""} ${isEpic ? "text-purple-400" : "text-gray-300"}`} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
        {isEpic ? (
          <><span className="text-purple-500 text-sm">⚡</span><span className="text-xs font-semibold text-gray-700 truncate flex-1">{group.parentSummary}</span><span className="text-xs text-purple-400 font-mono flex-shrink-0">{group.parentKey}</span></>
        ) : <span className="text-xs font-semibold text-gray-400 flex-1">Sin épica</span>}
        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${addedCount > 0 ? "bg-blue-100 text-blue-600" : isEpic ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500"}`}>
          {addedCount > 0 ? `${addedCount}/` : ""}{group.issues.length}
        </span>
      </button>
      {!collapsed && (
        <div className="ml-3 mt-1 relative">
          <div className={`absolute left-0 top-0 bottom-2 w-px ${isEpic ? "bg-purple-200" : "bg-gray-200"}`} />
          <div className="space-y-1.5 pl-4">
            {group.issues.map((issue) => {
              const added = entries.some(e => e.issueKey === issue.key);
              return (
                <div key={issue.key} className="relative">
                  <div className={`absolute -left-4 top-1/2 w-3 h-px ${isEpic ? "bg-purple-200" : "bg-gray-200"}`} />
                  <div className={`absolute -left-[18px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border ${isEpic ? "border-purple-300 bg-white" : "border-gray-300 bg-white"}`} />
                  <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${added ? "border-blue-200 bg-blue-50" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"}`}>
                    <div className="min-w-0 flex-1 mr-3">
                      <p className={`text-sm font-medium truncate ${added ? "text-blue-800" : "text-gray-900"}`}>{issue.summary}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-xs font-mono font-semibold text-blue-500">{issue.key}</span>
                        <IssueTypeBadge type={issue.issueType} />
                        <StatusBadge status={issue.status} />
                      </div>
                    </div>
                    <button onClick={() => onAdd(issue)} disabled={added} className={`flex-shrink-0 text-sm font-medium px-3 py-1.5 rounded-lg transition-all ${added ? "text-blue-400 bg-blue-100 cursor-default" : "text-blue-600 hover:bg-blue-50 border border-blue-200"}`}>
                      {added ? "✓" : "+ Agregar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarView({ userId }: { userId: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dailyHours, setDailyHours] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const DAYS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

  useEffect(() => { fetchCalendar(); }, [year, month]);

  const fetchCalendar = async () => {
    setLoading(true);
    const res = await fetch(`/api/jira/calendar?year=${year}&month=${month}`);
    if (res.ok) { const data = await res.json(); setDailyHours(data.dailyHours || {}); }
    setLoading(false);
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const getDayColor = (dateStr: string, dayOfWeek: number) => {
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const hours = dailyHours[dateStr] || 0;
    const isFuture = dateStr > today;
    if (isWeekend) return { bg: "bg-gray-50", text: "text-gray-300", bar: null, label: null };
    if (isFuture) return { bg: "bg-white", text: "text-gray-400", bar: null, label: null };
    if (hours >= OBJETIVO_HORAS) return { bg: "bg-green-50", text: "text-green-800", bar: "bg-green-400", label: `${hours.toFixed(1)}h` };
    if (hours > 0) return { bg: "bg-orange-50", text: "text-orange-800", bar: "bg-orange-400", label: `${hours.toFixed(1)}h` };
    return { bg: "bg-red-50", text: "text-red-300", bar: null, label: null };
  };

  const totalHours = Object.values(dailyHours).reduce((a, b) => a + b, 0);
  const workedDays = Object.keys(dailyHours).filter(d => {
    const dow = new Date(d + "T12:00:00").getDay();
    return dow !== 0 && dow !== 6;
  }).length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-gray-900 text-base">Calendario de imputaciones</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {loading ? "Cargando..." : `${workedDays} días imputados · ${totalHours.toFixed(1)}h totales`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-sm font-semibold text-gray-900 w-36 text-center">{MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth} disabled={year === now.getFullYear() && month === now.getMonth() + 1} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-30">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-400" />Completo (≥7.2h)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-400" />Parcial</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-200" />Sin imputar</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayOfWeek = (idx) % 7;
          const { bg, text, bar, label } = getDayColor(dateStr, dayOfWeek);
          const isToday = dateStr === today;
          return (
            <div key={dateStr} className={`relative rounded-xl p-2 ${bg} ${isToday ? "ring-2 ring-blue-400 ring-offset-1" : ""} min-h-[56px] flex flex-col`}>
              <span className={`text-xs font-semibold ${text} ${isToday ? "text-blue-600" : ""}`}>{day}</span>
              {bar && (
                <div className="mt-auto">
                  <div className={`h-1 rounded-full ${bar} mt-1`} style={{ width: `${Math.min((dailyHours[dateStr] || 0) / JORNADA_HORAS * 100, 100)}%` }} />
                  <span className="text-xs font-medium text-gray-500 mt-0.5 block">{label}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function groupIssues(issues: Issue[]): Group[] {
  const groups: Record<string, Group> = {};
  for (const issue of issues) {
    const key = issue.parentKey || "__none__";
    if (!groups[key]) groups[key] = { parentKey: issue.parentKey, parentSummary: issue.parentSummary, issues: [] };
    groups[key].issues.push(issue);
  }
  return Object.values(groups).sort((a, b) => {
    if (a.parentKey === null) return 1; if (b.parentKey === null) return -1;
    return (a.parentKey || "").localeCompare(b.parentKey || "");
  });
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<{ accountId: string; displayName: string; email: string; avatarUrl: string } | null>(null);
  const [issueSearch, setIssueSearch] = useState("");

  useEffect(() => { fetchUser(); fetchProjects(); }, []);
  useEffect(() => { if (selectedProject) fetchIssues(selectedProject); else setIssues([]); setIssueSearch(""); }, [selectedProject]);

  const fetchUser = async () => { const res = await fetch("/api/auth/me"); if (res.ok) { const data = await res.json(); setUser(data.user); } };
  const fetchProjects = async () => {
    setLoadingProjects(true);
    const res = await fetch("/api/jira/issues");
    if (res.status === 401) { window.location.href = "/"; return; }
    const data = await res.json(); setProjects(data.projects || []); setLoadingProjects(false);
  };
  const fetchIssues = async (pk: string) => { setLoadingIssues(true); const res = await fetch(`/api/jira/issues?project=${pk}`); const data = await res.json(); setIssues(data.issues || []); setLoadingIssues(false); };
  const addEntry = (issue: Issue) => { if (entries.find(e => e.issueKey === issue.key)) return; setEntries([...entries, { issueKey: issue.key, summary: issue.summary, hours: 0, minutes: 0, comment: "" }]); };
  const updateEntry = (issueKey: string, field: keyof Entry, value: string | number) => setEntries(entries.map(e => e.issueKey === issueKey ? { ...e, [field]: value } : e));
  const removeEntry = (issueKey: string) => setEntries(entries.filter(e => e.issueKey !== issueKey));

  const totalHoras = entries.reduce((acc, e) => acc + e.hours + e.minutes / 60, 0);
  const porcentaje = Math.min((totalHoras / JORNADA_HORAS) * 100, 100);
  const llegaObjetivo = totalHoras >= OBJETIVO_HORAS;
  const filteredIssues = issues.filter(i => i.summary.toLowerCase().includes(issueSearch.toLowerCase()) || i.key.toLowerCase().includes(issueSearch.toLowerCase()));
  const groups = groupIssues(filteredIssues);

  const handleSubmit = async () => {
    if (entries.length === 0) return; setSubmitting(true); setError("");
    const res = await fetch("/api/jira/worklog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: entries.map(e => ({ ...e, date })) }) });
    const data = await res.json();
    if (data.errors?.length > 0) setError(`No se pudieron imputar: ${data.errors.map((e: any) => e.issueKey).join(", ")}`);
    else setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-200">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Horas imputadas!</h2>
          <p className="text-gray-500 mb-2">Registraste <span className="font-semibold text-gray-800">{totalHoras.toFixed(1)}h</span> en Jira.</p>
          <p className="text-sm text-gray-400 mb-8">{new Date(date + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <button onClick={() => { setSubmitted(false); setEntries([]); }} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors">Imputar otro día</button>
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
              <svg style={{width:18,height:18}} className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="font-bold text-gray-900 text-sm">Imputación de Horas</span>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              {user.avatarUrl ? <img src={user.avatarUrl} className="w-8 h-8 rounded-full ring-2 ring-gray-100" alt={user.displayName} /> : <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">{user.displayName.charAt(0)}</div>}
              <div className="hidden sm:block"><p className="text-sm font-medium text-gray-900 leading-tight">{user.displayName}</p><p className="text-xs text-gray-400 leading-tight">{user.email}</p></div>
              <a href="/api/auth/logout" className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-1 border border-gray-200 rounded-lg px-2.5 py-1.5">Salir</a>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Progreso */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Fecha de imputación</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex-1 sm:max-w-sm">
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Progreso del día</span>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${llegaObjetivo ? "text-green-600" : "text-orange-500"}`}>{totalHoras.toFixed(1)}h</span>
                  <span className="text-gray-300 text-sm font-medium"> / {JORNADA_HORAS}h</span>
                </div>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${llegaObjetivo ? "bg-gradient-to-r from-green-400 to-green-500" : "bg-gradient-to-r from-orange-300 to-orange-500"}`} style={{ width: `${porcentaje}%` }} />
              </div>
              <div className="flex justify-between mt-1.5">
                <p className="text-xs text-gray-400">Objetivo: {OBJETIVO_HORAS}h (90% de la jornada)</p>
                {llegaObjetivo && <p className="text-xs text-green-600 font-medium">✓ Completado</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Paneles */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Izquierdo */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div><h2 className="font-bold text-gray-900 text-base">Buscar tickets</h2><p className="text-xs text-gray-400 mt-0.5">Click en la épica para expandir</p></div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Proyecto</label>
              {loadingProjects ? <div className="flex items-center gap-2 text-sm text-gray-400 py-2"><div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />Cargando proyectos...</div>
                : <ProjectSelector projects={projects} value={selectedProject} onChange={setSelectedProject} />}
            </div>
            {selectedProject && (
              <div className="relative">
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Filtrar tickets..." value={issueSearch} onChange={e => setIssueSearch(e.target.value)} className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
            <div className="max-h-[480px] overflow-y-auto pr-1">
              {loadingIssues ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400"><div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />Cargando tickets...</div>
                : !selectedProject ? <div className="text-center py-10"><div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2"><svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg></div><p className="text-sm text-gray-400">Elegí un proyecto para ver sus tickets</p></div>
                : filteredIssues.length === 0 ? <div className="text-center py-10 text-sm text-gray-400">No se encontraron tickets activos</div>
                : groups.map(group => <EpicGroup key={group.parentKey || "__none__"} group={group} entries={entries} onAdd={addEntry} />)}
            </div>
          </div>

          {/* Derecho */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
            <div className="mb-4"><h2 className="font-bold text-gray-900 text-base">Horas del día</h2><p className="text-xs text-gray-400 mt-0.5">{entries.length === 0 ? "Ningún ticket seleccionado" : `${entries.length} ticket${entries.length > 1 ? "s" : ""} seleccionado${entries.length > 1 ? "s" : ""}`}</p></div>
            {entries.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3"><svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                <p className="text-sm font-medium text-gray-400">Sin tickets seleccionados</p><p className="text-xs text-gray-300 mt-1">Agregá tickets desde el panel izquierdo</p>
              </div>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {entries.map(entry => (
                  <div key={entry.issueKey} className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{entry.summary}</p><span className="text-xs font-mono font-semibold text-blue-500">{entry.issueKey}</span></div>
                      <button onClick={() => removeEntry(entry.issueKey)} className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5"><input type="number" min={0} max={24} value={entry.hours} onChange={e => updateEntry(entry.issueKey, "hours", parseInt(e.target.value) || 0)} className="w-10 text-center text-sm font-semibold text-gray-900 focus:outline-none" /><span className="text-xs text-gray-400">h</span></div>
                      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5"><input type="number" min={0} max={59} step={15} value={entry.minutes} onChange={e => updateEntry(entry.issueKey, "minutes", parseInt(e.target.value) || 0)} className="w-10 text-center text-sm font-semibold text-gray-900 focus:outline-none" /><span className="text-xs text-gray-400">min</span></div>
                      <input type="text" placeholder="Comentario (opcional)" value={entry.comment} onChange={e => updateEntry(entry.issueKey, "comment", e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {error && <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl"><p className="text-sm text-red-600">{error}</p></div>}
            {entries.length > 0 && (
              <button onClick={handleSubmit} disabled={submitting || totalHoras === 0} className={`mt-4 w-full font-semibold py-3 rounded-xl transition-all text-sm ${totalHoras === 0 ? "bg-gray-100 text-gray-400 cursor-not-allowed" : submitting ? "bg-blue-400 text-white cursor-wait" : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"}`}>
                {submitting ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Imputando en Jira...</span> : `Imputar ${totalHoras.toFixed(1)}h en Jira →`}
              </button>
            )}
          </div>
        </div>

        {/* Calendario */}
        {user && <CalendarView userId={user.accountId} />}
      </div>
    </main>
  );
}