"use client";

import { useEffect, useState, useRef } from "react";
import AppHeader from "@/components/AppHeader";

interface Issue {
  key: string; summary: string; status: string;
  project: string; projectKey: string; issueType: string;
  parentKey: string | null; parentSummary: string | null;
}

interface WorklogCell {
  worklogId: string | null;
  seconds: number;
  raw: string;
  comment: string;
  dirty: boolean;
}

interface RowEntry {
  issue: Issue;
  cells: Record<string, WorklogCell>;
}

interface Project { key: string; name: string; }
interface IssueGroup { parentKey: string | null; parentSummary: string | null; issues: Issue[]; }

const ISSUE_TYPE_STYLES: Record<string, { emoji: string; color: string }> = {
  "Epic": { emoji: "⚡", color: "#7C3AED" }, "Story": { emoji: "📗", color: "#059669" },
  "Task": { emoji: "✅", color: "#2563EB" }, "Sub-task": { emoji: "↳", color: "#9CA3AF" }, "Bug": { emoji: "🐛", color: "#DC2626" },
};

const STATUS_COLORS: Record<string, string> = {
  "In Development": "#3B82F6", "In Progress": "#3B82F6", "On Hold": "#F59E0B",
  "To Do": "#9CA3AF", "Done": "#10B981", "Closed": "#10B981", "Blocked": "#EF4444",
};

function parseToSeconds(val: string): number {
  const v = val.trim();
  if (!v) return 0;
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(parseFloat(v) * 3600);
  const hm1 = v.match(/^(\d+):(\d+)$/);
  if (hm1) return (parseInt(hm1[1]) * 60 + parseInt(hm1[2])) * 60;
  const hm2 = v.match(/^(\d+)h(\d+)m?$/i);
  if (hm2) return (parseInt(hm2[1]) * 60 + parseInt(hm2[2])) * 60;
  const hOnly = v.match(/^(\d+)h$/i);
  if (hOnly) return parseInt(hOnly[1]) * 3600;
  const mOnly = v.match(/^(\d+)m$/i);
  if (mOnly) return parseInt(mOnly[1]) * 60;
  return 0;
}

function secsToDisplay(s: number): string {
  if (!s) return "";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (m === 0) return `${h}h`; if (h === 0) return `${m}m`; return `${h}h${m}m`;
}

function secsToFmt(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function getWeekDays(refDate: Date): string[] {
  const days: string[] = [];
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() - ((refDate.getDay() + 6) % 7));
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function fmtWeekLabel(days: string[]): string {
  const from = new Date(days[0] + "T12:00:00");
  const to = new Date(days[6] + "T12:00:00");
  const fromStr = from.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  const toStr = to.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  return `${fromStr} – ${toStr}  ·  Semana ${getWeekNumber(from)} · ${to.getFullYear()}`;
}

function groupIssues(issues: Issue[]): IssueGroup[] {
  const g: Record<string, IssueGroup> = {};
  for (const i of issues) {
    const k = i.parentKey || "__none__";
    if (!g[k]) g[k] = { parentKey: i.parentKey, parentSummary: i.parentSummary, issues: [] };
    g[k].issues.push(i);
  }
  return Object.values(g).sort((a, b) => a.parentKey === null ? 1 : b.parentKey === null ? -1 : (a.parentKey || "").localeCompare(b.parentKey || ""));
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
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', border: '1px solid #DCDEE0', borderRadius: 3, padding: '6px 10px', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', cursor: 'pointer' }}>
        {selected ? <span style={{ color: '#1C1C1C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name} <span style={{ color: '#E30613', fontFamily: 'monospace', fontWeight: 700 }}>({selected.key})</span></span> : <span style={{ color: '#9CA3AF' }}>— Elegí un proyecto —</span>}
        <span style={{ color: '#9CA3AF', fontSize: 10, flexShrink: 0, marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ position: 'absolute', zIndex: 20, width: '100%', marginTop: 2, background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
        <div style={{ padding: 6, borderBottom: '1px solid #DCDEE0' }}>
          <input autoFocus type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 11, outline: 'none' }} />
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {filtered.length === 0 ? <p style={{ padding: '10px', fontSize: 11, color: '#9CA3AF', textAlign: 'center', margin: 0 }}>Sin resultados</p>
            : filtered.map(p => <button key={p.key} onClick={() => { onChange(p.key); setOpen(false); setSearch(""); }}
              style={{ width: '100%', textAlign: 'left', padding: '7px 10px', fontSize: 11, background: value === p.key ? '#FBEEEE' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#1C1C1C', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
              <span style={{ color: '#E30613', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, flexShrink: 0, marginLeft: 4 }}>{p.key}</span>
            </button>)}
        </div>
      </div>}
    </div>
  );
}

function EpicGroup({ group, onAdd, rows }: { group: IssueGroup; onAdd: (i: Issue) => void; rows: RowEntry[] }) {
  const [collapsed, setCollapsed] = useState(true);
  const isEpic = !!group.parentKey;
  const addedCount = group.issues.filter(i => rows.some(r => r.issue.key === i.key)).length;
  return (
    <div style={{ marginBottom: 5 }}>
      <button onClick={() => setCollapsed(!collapsed)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', borderRadius: 3, background: isEpic ? '#FBEEEE' : '#F9FAFB', border: `1px solid ${isEpic ? 'rgba(212,175,55,0.3)' : '#DCDEE0'}`, cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 10, color: '#9CA3AF', transform: collapsed ? 'rotate(-90deg)' : 'none', display: 'inline-block', transition: 'transform 0.12s' }}>▼</span>
        {isEpic ? <><span style={{ fontSize: 11 }}>⚡</span><span style={{ fontSize: 11, fontWeight: 700, color: '#1C1C1C', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.parentSummary}</span><span style={{ fontSize: 10, color: '#E30613', fontFamily: 'monospace', fontWeight: 700, flexShrink: 0 }}>{group.parentKey}</span></>
          : <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', flex: 1 }}>Sin épica</span>}
        <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 99, background: addedCount > 0 ? '#FBEEEE' : '#F3F4F6', color: addedCount > 0 ? '#E30613' : '#6B6B6B', flexShrink: 0 }}>
          {addedCount > 0 ? `${addedCount}/` : ""}{group.issues.length}
        </span>
      </button>
      {!collapsed && <div style={{ marginLeft: 8, marginTop: 3, paddingLeft: 10, borderLeft: `2px solid ${isEpic ? 'rgba(212,175,55,0.4)' : '#DCDEE0'}` }}>
        {group.issues.map(issue => {
          const added = rows.some(r => r.issue.key === issue.key);
          return (
            <div key={issue.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', marginBottom: 3, borderRadius: 3, border: `1px solid ${added ? 'rgba(212,175,55,0.4)' : '#DCDEE0'}`, background: added ? '#FFFDF0' : '#fff', gap: 6 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#1C1C1C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.summary}</p>
                <div style={{ display: 'flex', gap: 5, marginTop: 2, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: '#E30613' }}>{issue.key}</span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[issue.status] || '#9CA3AF', display: 'inline-block' }} />
                </div>
              </div>
              <button onClick={() => onAdd(issue)} disabled={added}
                style={{ flexShrink: 0, fontSize: 10, border: `1px solid ${added ? '#D4AF37' : '#DCDEE0'}`, borderRadius: 3, padding: '2px 7px', background: added ? '#FFFDF0' : '#fff', color: added ? '#856404' : '#E30613', cursor: added ? 'default' : 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {added ? "✓" : "+ Agregar"}
              </button>
            </div>
          );
        })}
      </div>}
    </div>
  );
}

const DAY_LABELS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const JORNADA_SEMANAL = 40 * 3600;

export default function Dashboard() {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const [refDate, setRefDate] = useState(now);
  const [rows, setRows] = useState<RowEntry[]>([]);
  const [user, setUser] = useState<{ accountId: string; displayName: string; email: string; avatarUrl: string } | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [activeTimerTicket, setActiveTimerTicket] = useState<{ key: string; summary: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Panel izquierdo
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [issueSearch, setIssueSearch] = useState("");

  // Filtros tabla
  const [filterProject, setFilterProject] = useState("");
  const [filterEpic, setFilterEpic] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterIssue, setFilterIssue] = useState("");
  const [soloMias, setSoloMias] = useState(true);

  // Guardado
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const days = getWeekDays(refDate);
  const pendingChanges = rows.some(r => Object.values(r.cells).some(c => c.dirty));

  const filteredRows = rows.filter(r =>
    (!filterProject || r.issue.project === filterProject) &&
    (!filterEpic || r.issue.parentSummary === filterEpic) &&
    (!filterStatus || r.issue.status === filterStatus) &&
    (!filterIssue || r.issue.key === filterIssue)
  );

  useEffect(() => { fetchUser(); fetchProjects(); }, []);
  useEffect(() => { fetchWeekData(); }, [refDate]);
  useEffect(() => { if (selectedProject) fetchIssues(selectedProject); else setIssues([]); setIssueSearch(""); }, [selectedProject]);

  const fetchUser = async () => {
    const res = await fetch("/api/auth/me");
    if (res.status === 401) { setSessionExpired(true); return; }
    if (res.ok) { const data = await res.json(); setUser(data.user); }
  };

  const fetchProjects = async () => {
    setLoadingProjects(true);
    const res = await fetch("/api/jira/issues");
    if (res.ok) { const data = await res.json(); setProjects(data.projects || []); }
    setLoadingProjects(false);
  };

  const fetchIssues = async (pk: string) => {
    setLoadingIssues(true);
    const res = await fetch(`/api/jira/issues?project=${pk}`);
    if (res.ok) { const data = await res.json(); setIssues(data.issues || []); }
    setLoadingIssues(false);
  };

  const fetchWeekData = async () => {
    const weekDays = getWeekDays(refDate);
    setLoading(true); setSaveSuccess(false); setSaveError("");
    const res = await fetch(`/api/jira/timesheet?from=${weekDays[0]}&to=${weekDays[6]}`);
    if (res.status === 401) { setSessionExpired(true); return; }
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    const entries: any[] = data.entries || [];
    const issueMap: Record<string, { issue: Issue; cells: Record<string, WorklogCell> }> = {};
    for (const entry of entries) {
      if (!issueMap[entry.issueKey]) {
        issueMap[entry.issueKey] = {
          issue: { key: entry.issueKey, summary: entry.issueSummary, status: entry.status || "", project: entry.project, projectKey: entry.projectKey, issueType: entry.issueType, parentKey: entry.parentKey, parentSummary: entry.parentSummary },
          cells: {},
        };
      }
      const existing = issueMap[entry.issueKey].cells[entry.date];
      if (existing) {
        existing.seconds += entry.timeSpentSeconds;
        existing.raw = secsToDisplay(existing.seconds);
      } else {
        issueMap[entry.issueKey].cells[entry.date] = { worklogId: entry.worklogId, seconds: entry.timeSpentSeconds, raw: secsToDisplay(entry.timeSpentSeconds), comment: entry.comment || "", dirty: false };
      }
    }
    setRows(Object.values(issueMap).map(v => ({ issue: v.issue, cells: v.cells })));
    setLoading(false);
  };

  const addIssue = (issue: Issue) => {
    if (rows.find(r => r.issue.key === issue.key)) return;
    setRows(prev => [...prev, { issue, cells: {} }]);
  };

  const removeRow = (key: string) => setRows(prev => prev.filter(r => r.issue.key !== key));

  const updateCell = (issueKey: string, date: string, raw: string) => {
    const seconds = parseToSeconds(raw);
    setRows(prev => prev.map(r => {
      if (r.issue.key !== issueKey) return r;
      const existing = r.cells[date];
      return { ...r, cells: { ...r.cells, [date]: { worklogId: existing?.worklogId || null, seconds, raw, comment: existing?.comment || "", dirty: true } } };
    }));
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true); setSaveError(""); setSaveSuccess(false);
    const errors: string[] = [];
    for (const row of rows) {
      for (const [date, cell] of Object.entries(row.cells)) {
        if (!cell.dirty) continue;
        const hours = Math.floor(cell.seconds / 3600);
        const minutes = Math.floor((cell.seconds % 3600) / 60);
        if (cell.seconds === 0 && cell.worklogId) {
          const res = await fetch("/api/jira/timesheet", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ issueKey: row.issue.key, worklogId: cell.worklogId }) });
          if (!res.ok) errors.push(row.issue.key);
        } else if (cell.seconds > 0 && cell.worklogId) {
          const res = await fetch("/api/jira/timesheet", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ issueKey: row.issue.key, worklogId: cell.worklogId, hours, minutes, comment: cell.comment, date }) });
          if (!res.ok) errors.push(row.issue.key);
        } else if (cell.seconds > 0 && !cell.worklogId) {
          const res = await fetch("/api/jira/worklog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: [{ issueKey: row.issue.key, hours, minutes, comment: cell.comment, date }] }) });
          const d = await res.json();
          if (d.errors?.length > 0) errors.push(row.issue.key);
        }
      }
    }
    if (errors.length > 0) setSaveError(`No se pudieron guardar: ${[...new Set(errors)].join(", ")}`);
    else { setSaveSuccess(true); await fetchWeekData(); }
    setSaving(false);
  };

  const handleTimerStop = (seconds: number, ticketKey: string, ticketSummary: string) => {
    const existing = rows.find(r => r.issue.key === ticketKey);
    const newSecs = (existing?.cells[today]?.seconds || 0) + seconds;
    if (existing) {
      updateCell(ticketKey, today, secsToDisplay(newSecs));
    } else {
      fetch(`/api/jira/issues?q=${encodeURIComponent(ticketKey)}`).then(r => r.json()).then(data => {
        const issue = data.issues?.[0];
        if (issue) setRows(prev => [...prev, { issue, cells: { [today]: { worklogId: null, seconds: newSecs, raw: secsToDisplay(newSecs), comment: "", dirty: true } } }]);
      });
    }
    setActiveTimerTicket(null);
  };

  const dayTotals: Record<string, number> = {};
  let weekTotal = 0;
  for (const day of days) { dayTotals[day] = rows.reduce((acc, r) => acc + (r.cells[day]?.seconds || 0), 0); weekTotal += dayTotals[day]; }
  const rowTotals: Record<string, number> = {};
  for (const row of rows) rowTotals[row.issue.key] = days.reduce((acc, d) => acc + (row.cells[d]?.seconds || 0), 0);

  const prevWeek = () => { const d = new Date(refDate); d.setDate(d.getDate() - 7); setRefDate(d); };
  const nextWeek = () => { const d = new Date(refDate); d.setDate(d.getDate() + 7); setRefDate(d); };
  const goToday = () => setRefDate(new Date());
  const isWeekend = (d: string) => { const dow = new Date(d + "T12:00:00").getDay(); return dow === 0 || dow === 6; };
  const weekRemaining = Math.max(JORNADA_SEMANAL - weekTotal, 0);
  const weekPct = Math.min((weekTotal / JORNADA_SEMANAL) * 100, 100);

  const filteredIssues = issues.filter(i => i.summary.toLowerCase().includes(issueSearch.toLowerCase()) || i.key.toLowerCase().includes(issueSearch.toLowerCase()));
  const groups = groupIssues(filteredIssues);

  if (sessionExpired) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#fff', padding: 32, borderRadius: 4, maxWidth: 360, textAlign: 'center', borderTop: '3px solid #D4AF37' }}>
        <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Sesión expirada</p>
        <a href="/api/auth/logout" style={{ display: 'block', background: '#E30613', color: '#fff', padding: '10px', borderRadius: 3, textDecoration: 'none', fontWeight: 700 }}>Volver a ingresar</a>
      </div>
    </div>
  );

  return (
    <main style={{ minHeight: '100vh', background: '#ECF0F1', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <AppHeader user={user} activeTab="dashboard" onTimerStop={handleTimerStop} activeTimerTicket={activeTimerTicket} />

      <div style={{ flex: 1, display: 'flex', height: 'calc(100vh - 57px)' }}>

        {/* PANEL IZQUIERDO */}
        <div style={{ width: 280, flexShrink: 0, background: '#fff', borderRight: '1px solid #DCDEE0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(212,175,55,0.3)', background: '#FAFAFA' }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1C', margin: 0 }}>Buscar tickets</h2>
            <p style={{ fontSize: 11, color: '#6B6B6B', margin: '2px 0 0' }}>Click en la épica para expandir</p>
          </div>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #DCDEE0' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6B6B6B', margin: '0 0 5px' }}>Proyecto</p>
            {loadingProjects ? <div style={{ fontSize: 11, color: '#6B6B6B' }}>Cargando...</div>
              : <ProjectSelector projects={projects} value={selectedProject} onChange={setSelectedProject} />}
          </div>
          {selectedProject && (
            <div style={{ padding: '6px 10px', borderBottom: '1px solid #DCDEE0' }}>
              <input type="text" placeholder="🔍 Filtrar tickets..." value={issueSearch} onChange={e => setIssueSearch(e.target.value)}
                style={{ width: '100%', border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 11, outline: 'none' }} />
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
            {loadingIssues ? <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: '#6B6B6B' }}>Cargando...</div>
              : !selectedProject ? <div style={{ textAlign: 'center', padding: '24px 0' }}><div style={{ fontSize: 28, marginBottom: 6 }}>📁</div><p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Elegí un proyecto</p></div>
              : filteredIssues.length === 0 ? <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>Sin tickets activos</p>
              : groups.map(g => <EpicGroup key={g.parentKey || "__none__"} group={g} onAdd={addIssue} rows={rows} />)}
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: 16, gap: 12 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ fontSize: 11, color: '#9CA3AF', letterSpacing: '0.08em', margin: '0 0 2px' }}>PASO 1 · <span style={{ color: '#E30613', fontWeight: 700 }}>ELIGE</span> · PASO 2 · <span style={{ color: '#E30613', fontWeight: 700 }}>IMPUTA</span> · PASO 3 · <span style={{ color: '#E30613', fontWeight: 700 }}>GUARDA</span></p>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#E30613', margin: 0 }}>Registro de horas</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={prevWeek} style={{ width: 28, height: 28, border: '1px solid #DCDEE0', borderRadius: 3, background: '#fff', cursor: 'pointer', fontSize: 12 }}>◀</button>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1C', minWidth: 240, textAlign: 'center' }}>{fmtWeekLabel(days)}</span>
              <button onClick={nextWeek} style={{ width: 28, height: 28, border: '1px solid #DCDEE0', borderRadius: 3, background: '#fff', cursor: 'pointer', fontSize: 12 }}>▶</button>
              <button onClick={goToday} style={{ fontSize: 11, fontWeight: 700, border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 10px', background: '#fff', cursor: 'pointer' }}>Hoy</button>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
              style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 12, background: '#fff', cursor: 'pointer', color: filterProject ? '#E30613' : '#6B6B6B', fontWeight: filterProject ? 700 : 400 }}>
              <option value="">Proyecto ▾</option>
              {[...new Set(rows.map(r => r.issue.project).filter(Boolean))].sort().map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterEpic} onChange={e => setFilterEpic(e.target.value)}
              style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 12, background: '#fff', cursor: 'pointer', color: filterEpic ? '#E30613' : '#6B6B6B', fontWeight: filterEpic ? 700 : 400 }}>
              <option value="">Épica ▾</option>
              {[...new Set(rows.map(r => r.issue.parentSummary).filter(Boolean))].sort().map(ep => <option key={ep} value={ep!}>{ep}</option>)}
            </select>
            <select value={filterIssue} onChange={e => setFilterIssue(e.target.value)}
              style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 12, background: '#fff', cursor: 'pointer', color: filterIssue ? '#E30613' : '#6B6B6B', fontWeight: filterIssue ? 700 : 400 }}>
              <option value="">Tarea ▾</option>
              {rows.filter((r, i, a) => a.findIndex(x => x.issue.key === r.issue.key) === i).sort((a, b) => a.issue.key.localeCompare(b.issue.key)).map(r => <option key={r.issue.key} value={r.issue.key}>{r.issue.key} · {r.issue.summary}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ border: '1px solid #DCDEE0', borderRadius: 3, padding: '5px 8px', fontSize: 12, background: '#fff', cursor: 'pointer', color: filterStatus ? '#E30613' : '#6B6B6B', fontWeight: filterStatus ? 700 : 400 }}>
              <option value="">Estado ▾</option>
              {[...new Set(rows.map(r => r.issue.status).filter(Boolean))].sort().map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6B6B6B', cursor: 'pointer' }}>
              <input type="checkbox" checked={soloMias} onChange={e => setSoloMias(e.target.checked)} style={{ accentColor: '#E30613', width: 14, height: 14 }} />
              Solo mis incidencias
            </label>
            {(filterProject || filterEpic || filterStatus || filterIssue) && (
              <button onClick={() => { setFilterProject(""); setFilterEpic(""); setFilterStatus(""); setFilterIssue(""); }}
                style={{ fontSize: 11, color: '#E30613', border: '1px solid #E30613', borderRadius: 3, padding: '4px 8px', background: '#fff', cursor: 'pointer' }}>
                ✕ Limpiar filtros
              </button>
            )}
          </div>

          {/* Tabla */}
          <div style={{ background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, overflow: 'hidden', flex: 1 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#E30613' }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 280, position: 'sticky', left: 0, background: '#E30613', zIndex: 10 }}>Incidencia</th>
                    {days.map((d, i) => (
                      <th key={d} style={{ textAlign: 'center', padding: '8px 4px', minWidth: 72, background: d === today ? '#C00000' : '#E30613', borderLeft: '1px solid rgba(255,255,255,0.15)' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>{DAY_LABELS[i]}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{new Date(d + "T12:00:00").getDate()}</div>
                      </th>
                    ))}
                    <th style={{ textAlign: 'center', padding: '8px 10px', minWidth: 70, background: '#C00000', borderLeft: '1px solid rgba(255,255,255,0.15)', fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>Total</th>
                    <th style={{ width: 28, background: '#E30613', borderLeft: '1px solid rgba(255,255,255,0.15)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={days.length + 3} style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <div style={{ width: 16, height: 16, border: '2px solid #DCDEE0', borderTop: '2px solid #E30613', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Cargando registros de la semana...
                      </div>
                    </td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={days.length + 3} style={{ textAlign: 'center', padding: '48px 16px', color: '#9CA3AF' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>No hay registros esta semana</p>
                      <p style={{ margin: '4px 0 0', fontSize: 12 }}>Elegí un proyecto en el panel izquierdo y agregá tickets</p>
                    </td></tr>
                  ) : filteredRows.length === 0 ? (
                    <tr><td colSpan={days.length + 3} style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF', fontSize: 13 }}>
                      No hay resultados con los filtros aplicados
                    </td></tr>
                  ) : filteredRows.map((row, ri) => {
                    const ts = ISSUE_TYPE_STYLES[row.issue.issueType] || { emoji: "📄", color: "#9CA3AF" };
                    const rowTotal = rowTotals[row.issue.key] || 0;
                    const hasDirty = Object.values(row.cells).some(c => c.dirty);
                    return (
                      <tr key={row.issue.key} style={{ borderBottom: '1px solid #F0F0F0', background: ri % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                        <td style={{ padding: '8px 14px', position: 'sticky', left: 0, background: ri % 2 === 0 ? '#fff' : '#FAFAFA', zIndex: 5, borderRight: '1px solid #F0F0F0' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            {hasDirty && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#E30613', flexShrink: 0, marginTop: 5 }} title="Sin guardar" />}
                            <span style={{ fontSize: 14, marginTop: 1, color: ts.color, flexShrink: 0 }}>{ts.emoji}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', gap: 6, marginBottom: 1 }}>
                                <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#E30613' }}>{row.issue.key}</span>
                                <span style={{ fontSize: 10, color: '#9CA3AF' }}>{row.issue.issueType}</span>
                              </div>
                              <p style={{ margin: 0, fontSize: 12, color: '#1C1C1C', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{row.issue.summary}</p>
                              <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                                {row.issue.parentSummary && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 99, background: '#F3F4F6', color: '#6B6B6B', border: '1px solid #DCDEE0' }}>⚡ {row.issue.parentSummary}</span>}
                                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 99, background: '#F3F4F6', color: '#6B6B6B', border: '1px solid #DCDEE0' }}>{row.issue.project}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        {days.map(d => {
                          const cell = row.cells[d];
                          const secs = cell?.seconds || 0;
                          const raw = cell?.raw ?? "";
                          const we = isWeekend(d);
                          const isDirty = cell?.dirty || false;
                          return (
                            <td key={d} style={{ padding: '4px 3px', textAlign: 'center', borderLeft: '1px solid #F0F0F0', background: we ? '#F5F5F5' : d === today ? '#FFF9F0' : 'transparent', position: 'relative' }}>
                              {we ? <span style={{ color: '#DCDEE0', fontSize: 12 }}>—</span> : (
                                <>
                                  <input type="text" value={raw}
                                    onChange={e => updateCell(row.issue.key, d, e.target.value)}
                                    onBlur={e => { const s = parseToSeconds(e.target.value); updateCell(row.issue.key, d, s > 0 ? secsToDisplay(s) : ""); }}
                                    placeholder="0:00"
                                    style={{ width: '100%', textAlign: 'center', border: secs > 0 ? `1px solid ${isDirty ? 'rgba(212,175,55,0.8)' : 'rgba(212,175,55,0.3)'}` : '1px solid transparent', borderRadius: 3, padding: '5px 3px', fontSize: 13, fontWeight: secs > 0 ? 700 : 400, color: secs > 0 ? '#1C1C1C' : '#DCDEE0', background: secs > 0 ? (isDirty ? '#FFFBEB' : '#FFFDF0') : 'transparent', outline: 'none', cursor: 'text' }}
                                    onFocus={e => { e.currentTarget.style.borderColor = '#E30613'; e.currentTarget.style.background = '#FFF5F5'; }}
                                    onBlurCapture={e => { const s = parseToSeconds(e.currentTarget.value); e.currentTarget.style.borderColor = s > 0 ? 'rgba(212,175,55,0.5)' : 'transparent'; e.currentTarget.style.background = s > 0 ? '#FFFDF0' : 'transparent'; }}
                                  />
                                  {secs > 0 && <div style={{ position: 'absolute', top: 2, right: 3, width: 5, height: 5, borderRadius: '50%', background: isDirty ? '#F59E0B' : '#10B981' }} title={isDirty ? 'Sin guardar' : 'En Jira'} />}
                                </>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', padding: '6px 6px', borderLeft: '1px solid #F0F0F0', fontWeight: 700, fontSize: 13, color: rowTotal > 0 ? '#1C1C1C' : '#DCDEE0' }}>
                          {rowTotal > 0 ? secsToDisplay(rowTotal) : "—"}
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 4px', borderLeft: '1px solid #F0F0F0' }}>
                          <button onClick={() => removeRow(row.issue.key)} title="Quitar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DCDEE0', fontSize: 14 }}
                            onMouseOver={e => e.currentTarget.style.color = '#E30613'} onMouseOut={e => e.currentTarget.style.color = '#DCDEE0'}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#1C1C1C', borderTop: '2px solid rgba(212,175,55,0.4)' }}>
                      <td style={{ padding: '8px 14px', position: 'sticky', left: 0, background: '#1C1C1C', zIndex: 5, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total del día</td>
                      {days.map(d => {
                        const s = dayTotals[d] || 0;
                        const we = isWeekend(d);
                        const isOver = s > 8 * 3600; const isFull = s >= 8 * 3600;
                        return <td key={d} style={{ textAlign: 'center', padding: '8px 3px', borderLeft: '1px solid rgba(255,255,255,0.08)', opacity: we ? 0.3 : 1 }}>
                          {s > 0 ? <span style={{ fontSize: 13, fontWeight: 700, color: isOver ? '#EF4444' : isFull ? '#10B981' : '#F59E0B' }}>{isOver ? '⚠ ' : ''}{secsToDisplay(s)}</span>
                            : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>—</span>}
                        </td>;
                      })}
                      <td style={{ textAlign: 'center', padding: '8px', borderLeft: '1px solid rgba(255,255,255,0.08)', background: weekTotal >= JORNADA_SEMANAL ? '#1F4A2A' : '#1C1C1C' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: weekTotal >= JORNADA_SEMANAL ? '#10B981' : '#fff' }}>{secsToDisplay(weekTotal) || '0h'}</span>
                      </td>
                      <td style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Footer */}
          <div style={{ background: '#fff', border: '1px solid #DCDEE0', borderRadius: 3, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: '#6B6B6B' }}>Semana:</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1C' }}>{secsToFmt(weekTotal)}</span>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>de {secsToFmt(JORNADA_SEMANAL)}</span>
                {weekRemaining > 0 && <span style={{ fontSize: 12, color: '#E30613' }}>· faltan {secsToFmt(weekRemaining)}</span>}
                {weekRemaining === 0 && <span style={{ fontSize: 12, color: '#10B981', fontWeight: 700 }}>· ✓ Semana completa</span>}
              </div>
              <div style={{ height: 6, background: '#ECF0F1', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: weekTotal >= JORNADA_SEMANAL ? '#10B981' : '#E30613', width: `${weekPct}%`, transition: 'width 0.3s', borderRadius: 99 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {saveError && <span style={{ fontSize: 12, color: '#E30613' }}>{saveError}</span>}
              {saveSuccess && <span style={{ fontSize: 12, color: '#10B981', fontWeight: 700 }}>✓ Guardado en Jira</span>}
              {pendingChanges && !saveSuccess && <span style={{ fontSize: 12, color: '#F59E0B' }}>Con cambios pendientes</span>}
              {!pendingChanges && !saveSuccess && rows.length > 0 && <span style={{ fontSize: 12, color: '#9CA3AF' }}>Sin cambios pendientes</span>}
              <button onClick={handleSave} disabled={saving || !pendingChanges}
                style={{ background: !pendingChanges ? '#ECF0F1' : '#E30613', color: !pendingChanges ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 3, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: !pendingChanges ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar en Jira'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}